/**
 * Jest setup — extends Jest with React Testing Library matchers
 *
 * [AV-069] v5.5.0 — adds toBeInTheDocument(), toHaveTextContent(), etc.
 * Runs once after Jest is initialized, before any test file.
 */

require('@testing-library/jest-dom');
