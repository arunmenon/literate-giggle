# Session Type: Test-Driven Development

Use this session type when strict TDD discipline is required or requested.

---

## When to Use

- User explicitly requests TDD
- Building critical business logic
- Creating APIs with complex behavior
- Bug fixes requiring regression tests
- High-reliability requirements

---

## Session File Header

```markdown
**Session Type**: TDD
**Status**: `PENDING`
**Coverage Target**: [percentage or "all new code"]
```

---

## Iron Law

**No production code without a preceding failing test.**

This is non-negotiable. If you write production code before a test exists and fails, that code must be deleted and rewritten properly.

---

## RED-GREEN-REFACTOR Cycle

### 1. RED - Write Failing Test

Write ONE minimal test describing desired behavior.

**Test Requirements**:
- Tests ONE specific behavior
- Descriptive name: `test_<function>_<scenario>_<expected>`
- Uses real code (not mocks, unless external dependency)
- Focuses on behavior, not implementation

```typescript
// Example
test('calculateDiscount_withValidCoupon_returnsDiscountedPrice', () => {
  const result = calculateDiscount(100, 'SAVE20');
  expect(result).toBe(80);
});
```

### 2. VERIFY RED - Confirm Failure

**MANDATORY**: Execute test, verify it fails.

```bash
# Run the test
npm test -- --grep "calculateDiscount"
# OR
pytest -k "test_calculate_discount"
```

**Check**:
- Test fails (not errors due to syntax)
- Failure message indicates missing feature
- If test passes: you're testing existing behavior, rewrite

### 3. GREEN - Write Minimal Code

Write the SIMPLEST code that passes the test.

**Rules**:
- Only what test requires
- No extra features
- No "improvements"
- Hardcoding acceptable if it passes

```typescript
// Minimal implementation
function calculateDiscount(price: number, coupon: string): number {
  if (coupon === 'SAVE20') return price * 0.8;
  return price;
}
```

### 4. VERIFY GREEN - Confirm Pass

**MANDATORY**: Execute test, verify it passes.

```bash
# Run all tests
npm test
```

**Check**:
- New test passes
- All existing tests still pass
- No errors or warnings

### 5. REFACTOR - Improve Quality

Only AFTER tests are green:

- Remove duplication
- Improve names
- Extract helpers
- Simplify logic

**Critical**: Keep tests passing throughout. Re-run after each change.

---

## Violations Requiring Code Deletion

If any of these occur, DELETE the code and start over:

1. **Production code written before test**
2. **Test retrofitted to existing code**
3. **"I'll add tests later"**
4. **Test written to pass (not to fail first)**

**Why**: TDD's value comes from the RED phase. Skipping it means you don't know if your test actually tests anything.

---

## Anti-Pattern Detection

Watch for these testing anti-patterns:

### 1. Testing Mock Behavior
```typescript
// BAD - testing that mock exists
expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();

// GOOD - testing real behavior
expect(screen.getByRole('navigation')).toBeInTheDocument();
```

### 2. Test-Only Methods in Production
```typescript
// BAD - method only exists for tests
class Session {
  _testReset() { /* only called in tests */ }
}

// GOOD - test utilities separate from production
// test-utils.ts
export function resetSession(session: Session) { /* ... */ }
```

### 3. Mocking Without Understanding
```typescript
// BAD - mock removes side effect test depends on
vi.mock('database', () => ({ save: vi.fn() }));
// Now test can't verify data was actually saved!

// GOOD - mock only external/slow parts
vi.mock('external-api'); // Mock network, keep DB real
```

### 4. Incomplete Mocks
```typescript
// BAD - missing fields that code depends on
const mockUser = { id: 1, name: 'Test' };
// Code crashes when accessing mockUser.email

// GOOD - complete mock matching real structure
const mockUser = { id: 1, name: 'Test', email: 'test@example.com', role: 'user' };
```

---

## Flaky Test Prevention

Use condition-based waiting, not timeouts:

```typescript
// BAD - arbitrary timeout
await new Promise(r => setTimeout(r, 100));
expect(result).toBeDefined();

// GOOD - wait for condition
await waitFor(() => expect(result).toBeDefined());
```

**Pattern Reference**:
| Wait For | Pattern |
|----------|---------|
| Element appears | `waitFor(() => screen.getByText('Done'))` |
| State changes | `waitFor(() => expect(state).toBe('ready'))` |
| Async completes | `await act(async () => { /* trigger */ })` |

---

## Session Tracking

```markdown
### TDD Progress

**Cycle Count**: X complete cycles

**Current Cycle**:
- RED: [test name] - Failed as expected
- GREEN: [implementation] - Passes
- REFACTOR: [changes made]

**Coverage**: X% (target: Y%)

**Tests Written**:
- [x] test_feature_a_scenario_1
- [x] test_feature_a_scenario_2
- [ ] test_feature_b_scenario_1 (in progress)
```

---

## Quality Checklist

Before marking TDD session complete:

- [ ] Every feature has at least one test
- [ ] Saw each test fail before implementing
- [ ] Each test failed for expected reason
- [ ] Wrote minimal code to pass
- [ ] All tests pass
- [ ] No anti-patterns present
- [ ] Coverage target met
- [ ] Session documents RED-GREEN-REFACTOR cycles
