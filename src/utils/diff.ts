/**
 * Create a unified diff between two strings
 */
export function createUnifiedDiff(
  filePath: string,
  original: string,
  modified: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const diff: string[] = [];
  diff.push(`--- a/${filePath}`);
  diff.push(`+++ b/${filePath}`);

  // Simple line-by-line diff (not optimal but works for our use case)
  let i = 0;
  let j = 0;
  let hunkStart = -1;
  let hunkLines: string[] = [];

  const flushHunk = () => {
    if (hunkLines.length > 0 && hunkStart >= 0) {
      // Count additions and deletions
      const deletions = hunkLines.filter(l => l.startsWith('-')).length;
      const additions = hunkLines.filter(l => l.startsWith('+')).length;
      const context = hunkLines.filter(l => l.startsWith(' ')).length;

      diff.push(`@@ -${hunkStart + 1},${deletions + context} +${hunkStart + 1},${additions + context} @@`);
      diff.push(...hunkLines);
      hunkLines = [];
      hunkStart = -1;
    }
  };

  while (i < originalLines.length || j < modifiedLines.length) {
    const origLine = i < originalLines.length ? originalLines[i] : null;
    const modLine = j < modifiedLines.length ? modifiedLines[j] : null;

    if (origLine === modLine) {
      // Lines match - context line
      if (hunkLines.length > 0) {
        hunkLines.push(` ${origLine || ''}`);
        // Flush hunk after 3 context lines
        const recentContext = hunkLines.slice(-3).every(l => l.startsWith(' '));
        if (recentContext && hunkLines.length > 6) {
          flushHunk();
        }
      }
      i++;
      j++;
    } else {
      // Lines differ
      if (hunkStart < 0) {
        hunkStart = Math.max(0, i - 3);
        // Add leading context
        for (let k = hunkStart; k < i; k++) {
          hunkLines.push(` ${originalLines[k]}`);
        }
      }

      // Simple approach: show deletion then addition
      if (origLine !== null && (modLine === null || origLine !== modifiedLines[j])) {
        hunkLines.push(`-${origLine}`);
        i++;
      }
      if (modLine !== null && (origLine === null || modLine !== originalLines[i - 1])) {
        hunkLines.push(`+${modLine}`);
        j++;
      }
    }

    // Prevent infinite loops
    if (i > originalLines.length + modifiedLines.length) {
      break;
    }
  }

  flushHunk();

  return diff.join('\n');
}

/**
 * Apply a simple text replacement to content
 */
export function applyTextChange(
  content: string,
  startLine: number,
  endLine: number,
  newText: string
): string {
  const lines = content.split('\n');
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const newLines = newText.split('\n');
  
  return [...before, ...newLines, ...after].join('\n');
}

/**
 * Count the number of changed lines between two strings
 */
export function countChangedLines(original: string, modified: string): {
  added: number;
  removed: number;
  total: number;
} {
  const origLines = new Set(original.split('\n'));
  const modLines = new Set(modified.split('\n'));

  let added = 0;
  let removed = 0;

  for (const line of modLines) {
    if (!origLines.has(line)) {
      added++;
    }
  }

  for (const line of origLines) {
    if (!modLines.has(line)) {
      removed++;
    }
  }

  return { added, removed, total: added + removed };
}

