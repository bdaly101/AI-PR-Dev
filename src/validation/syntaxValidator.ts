import * as ts from 'typescript';
import { logger } from '../utils/logging';

/**
 * Result of syntax validation for a single file
 */
export interface FileValidationResult {
  filePath: string;
  isValid: boolean;
  errors: SyntaxError[];
}

/**
 * A syntax error found during validation
 */
export interface SyntaxError {
  line: number;
  column: number;
  message: string;
  code: number;
}

/**
 * Result of validating multiple files
 */
export interface ValidationResult {
  isValid: boolean;
  files: FileValidationResult[];
  totalErrors: number;
  errorSummary: string;
}

/**
 * Validate TypeScript/JavaScript syntax for a file
 */
export function validateTypescriptSyntax(
  filePath: string,
  content: string
): FileValidationResult {
  const errors: SyntaxError[] = [];

  // Determine if this is TypeScript or JavaScript
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJavaScript = filePath.endsWith('.js') || filePath.endsWith('.jsx');

  if (!isTypeScript && !isJavaScript) {
    // Not a JS/TS file, consider it valid
    return { filePath, isValid: true, errors: [] };
  }

  try {
    // Compiler options for syntax-only parsing
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: false, // Don't be too strict for validation
      noEmit: true,
      skipLibCheck: true,
      allowJs: true,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    };

    // Create a virtual file system for the single file
    const host: ts.CompilerHost = {
      getSourceFile: (fileName) => {
        if (fileName === filePath || fileName.endsWith(filePath)) {
          return ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true,
            isTypeScript 
              ? (filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
              : (filePath.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS)
          );
        }
        return undefined;
      },
      getDefaultLibFileName: () => 'lib.d.ts',
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (fileName) => fileName === filePath || fileName.endsWith(filePath),
      readFile: (fileName) => (fileName === filePath || fileName.endsWith(filePath)) ? content : undefined,
    };

    const program = ts.createProgram([filePath], compilerOptions, host);
    
    // Get syntax errors (parse diagnostics)
    const syntaxDiagnostics = program.getSyntacticDiagnostics();
    
    for (const diagnostic of syntaxDiagnostics) {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start
        );

        errors.push({
          line: line + 1, // 1-indexed
          column: character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          code: diagnostic.code,
        });
      }
    }

    // Get semantic errors (type errors)
    const semanticDiagnostics = program.getSemanticDiagnostics();

    // Only include critical semantic errors (not warnings)
    for (const diagnostic of semanticDiagnostics) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        if (diagnostic.file && diagnostic.start !== undefined) {
          const { line, character } = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start
          );

          // Skip certain errors that are likely due to missing type definitions
          const skipCodes = [
            2307, // Cannot find module
            2304, // Cannot find name (often external types)
            2503, // Cannot find namespace
            7016, // Could not find declaration file
          ];

          if (!skipCodes.includes(diagnostic.code)) {
            errors.push({
              line: line + 1,
              column: character + 1,
              message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
              code: diagnostic.code,
            });
          }
        }
      }
    }

  } catch (error) {
    logger.error({ error, filePath }, 'Error during syntax validation');
    errors.push({
      line: 1,
      column: 1,
      message: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: -1,
    });
  }

  return {
    filePath,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate multiple files
 */
export function validateMultipleFiles(
  files: Array<{ path: string; content: string }>
): ValidationResult {
  const results: FileValidationResult[] = [];
  let totalErrors = 0;

  for (const file of files) {
    const result = validateTypescriptSyntax(file.path, file.content);
    results.push(result);
    totalErrors += result.errors.length;
  }

  const isValid = totalErrors === 0;
  
  // Generate error summary
  let errorSummary = '';
  if (!isValid) {
    const filesWithErrors = results.filter(r => !r.isValid);
    errorSummary = `Found ${totalErrors} syntax error(s) in ${filesWithErrors.length} file(s):\n`;
    
    for (const file of filesWithErrors) {
      errorSummary += `\n**${file.filePath}:**\n`;
      for (const error of file.errors.slice(0, 5)) { // Limit to 5 errors per file
        errorSummary += `- Line ${error.line}: ${error.message}\n`;
      }
      if (file.errors.length > 5) {
        errorSummary += `  ... and ${file.errors.length - 5} more errors\n`;
      }
    }
  }

  logger.info({
    filesValidated: files.length,
    totalErrors,
    isValid,
  }, 'Syntax validation complete');

  return {
    isValid,
    files: results,
    totalErrors,
    errorSummary,
  };
}

/**
 * Format validation result for GitHub comment
 */
export function formatValidationResultForComment(result: ValidationResult): string {
  if (result.isValid) {
    return '✅ All files passed syntax validation.';
  }

  let comment = `## ❌ Syntax Validation Failed\n\n`;
  comment += `Found **${result.totalErrors} error(s)** that must be fixed before creating the PR.\n\n`;

  for (const file of result.files) {
    if (!file.isValid) {
      comment += `### \`${file.filePath}\`\n\n`;
      comment += `| Line | Error |\n`;
      comment += `|------|-------|\n`;
      
      for (const error of file.errors.slice(0, 10)) {
        const escapedMessage = error.message.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        comment += `| ${error.line} | ${escapedMessage} |\n`;
      }
      
      if (file.errors.length > 10) {
        comment += `\n*... and ${file.errors.length - 10} more errors*\n`;
      }
      comment += '\n';
    }
  }

  comment += `---\n`;
  comment += `*Please fix these syntax errors and try again.*`;

  return comment;
}

