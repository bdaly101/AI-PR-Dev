/**
 * Test file for staging validation
 * This file is used to test the AI PR Reviewer in staging
 */

export function testFunction(input: string): string {
  // TODO: Add input validation
  const result = input.toUpperCase();
  return result;
}

export function anotherTestFunction(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum = sum + numbers[i];
  }
  return sum;
}

