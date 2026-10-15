# AliceGrid & Omnibox (`AliceMath`)

An exact rational, dimensionally-typed spreadsheet and natural-language omnibox powered by **`AliceMath`** (originating from **Alice by San**).

Unlike standard JavaScript calculators and spreadsheets that rely on 64-bit IEEE-754 floating-point numbers (where `0.1 + 0.2 === 0.30000000000000004`) or separate libraries for fractions, physical[...]

---
# Demo Spreadsheet Calculator

🚀 Try the live demo (zero install): [alice-maths demo — open in your browser](https://dskhanal.github.io/alice-maths/)

Jump straight into the interactive AliceGrid to explore exact rationals, unit-aware calculations, and the Smart Omnibox. No build step required — the app runs directly in your browser.

Quick starters to try in the live demo:

- Press **Cmd/Ctrl + K** to open the Smart Omnibox and type natural math like `solve 2x + 3 = 11`.
- Enter `500 km to m` or `5.5 hr * 60 min` in a cell to see exact unit conversions.
- Type `1/3` next to `0.333` to compare exact rationals vs decimal approximations.
- Create a workbook and use the Scenario Workbooks (Drone, Robotics, Finance, Physics) to see real examples.

Now explore: exact arithmetic, SI-dimension tracking, linear solving, and delightful guardrails for incompatible operations — all in a simple spreadsheet interface.

## What is Different in AliceMath’s Architecture

In traditional mathematical software (such as `Math.js`, Python’s `SymPy` + `Pint`, or spreadsheet engines), **rational numbers**, **physical units**, and **algebraic polynomials** live in compl[...]

`AliceMath` eliminates that complexity through four architectural decisions:

### 1. The Unified Algebraic-Dimensional Value Tuple (`class V`)
Every token, sub-expression, unit, and unknown variable in `AliceMath` evaluates to a single homogeneous mathematical structure, **`class V`**:

$$V(b, a, \text{dim}) = (a \cdot x + b) \times \text{m}^{d_0} \cdot \text{s}^{d_1} \cdot \text{kg}^{d_2}$$

* **`this.b` (Constant Term)**: An exact `BigInt` rational fraction (`class Q`) representing the scalar value.
* **`this.a` (Linear Coefficient of $x$)**: An exact `BigInt` rational fraction (`class Q`) representing the slope of the unknown variable $x$.
* **`this.dim` (SI Dimensional Exponent Vector)**: A 3-element integer tuple `[m, s, kg]` tracking physical dimensions (length in meters, time in seconds, mass in kilograms).

Because numbers, units, and the unknown variable $x$ all share this exact same representation:
* A plain number `5` is `V(Q(5, 1), Q(0, 1), [0, 0, 0])`.
* The variable `x` is `V(Q(0, 1), Q(1, 1), [0, 0, 0])`.
* A physical unit `km` is `V(Q(1000, 1), Q(0, 1), [1, 0, 0])`.

### 2. Simultaneous Algebraic & Dimensional Guardrails in Four Primitives
Because every intermediate value is an instance of `V`, the parser does not need a separate symbolic algebra pass or unit-checking pass. All mathematical laws and epistemic boundaries are enforced[...]

* **Addition & Subtraction (`V.add`)**:
  Checks `same(this.dim, v.dim)` first. Attempting to add `5 m + 3 kg` immediately halts with `"Addition requires compatible units."` Otherwise, it adds both the constant terms (`this.b ± v.b`) a[...]
* **Multiplication (`V.mul`)**:
  Checks `!this.a.zero() && !v.a.zero()`. If both operands contain a non-zero $x$ coefficient (such as `x * x`), the product would become quadratic ($x^2$), so `V.mul` immediately halts with `"Onl[...]
* **Division (`V.div`)**:
  Checks `!v.a.zero()` to prevent rational expressions with $x$ in the denominator (such as `1 / x`), divides the `BigInt` rationals exactly, and subtracts the SI unit exponents `this.dim[i] - v.d[...]
* **Zero-Step Linear Equation Solving (`=`)**:
  Because any valid linear expression on either side of `=` already reduces to `V(b, a, dim)`, solving `left = right` requires zero symbolic tree manipulation:
  ```javascript
  const v = leftParser.complete().add(rightParser.complete(), -1);
  // Reduces the entire equation to: a * x + b = 0
  // Solution is simply x = -b / a:
  const solution = v.b.neg().div(v.a).text();
  ```
  Identity equations ($0x + 0 = 0 \rightarrow \text{"all x"}$) and contradictions ($0x + 5 = 0 \rightarrow \text{"no solution"}$) fall out naturally from checking `v.a.zero()` and `v.b.zero()`.

### 3. Exact Prime-Factor Decimal Termination Detection (`class Q`)
Every number is parsed directly from its string representation into a reduced `BigInt` rational `Q(n, d)` divided by `gcd(n, d)` (bounded by a 4,096-bit budget to prevent memory exhaustion):
* When rendering via `Q.text()`, `AliceMath` never converts `Q` to a 64-bit float.
* Instead, it divides all prime factors of `2n` and `5n` out of the reduced denominator `this.d`.
* **Exact Termination Theorem**: A reduced fraction $n/d$ has a terminating base-10 decimal expansion *if and only if* $d$ has no prime factors other than $2$ and $5$ ($d = 2^j \cdot 5^k$).
* If the stripped denominator equals `1n`, `Q.text()` performs exact `BigInt` long division to output the exact decimal (up to 5,000 decimal places). If any other prime factor remains (e.g., `1/3`[...]

### 4. Implicit Juxtaposition Binding Power in a Pratt Parser (`class Parser`)
Natural math expressions mix explicit operators (`2 * x + 3`) with implicit juxtaposition (`2x`, `500 km`, `3(x + 1)`). `AliceMath`’s `Parser` handles this in a single Pratt-style precedence loo[...]
* Standard addition/subtraction (`+`, `-`) has binding power `10`.
* Explicit multiplication/division (`*`, `/`) has binding power `20`.
* Implicit juxtaposition (when the next token is a declared unit, `(`, or `x`) is assigned binding power `25`—tighter than `*` and `/`, but looser than exponentiation `^` (`30`) and `%` (`40`).
* As a result, `convert 500 w * 2 hr to kj` or `solve 2x + 3(x - 1) = 12` parses deterministically in a single pass with a strict 256-token / 32-depth recursion budget and zero dynamic code execut[...]

---

## Quick Start

1. Clone or download this repository.
2. Open `index.html` directly in any modern browser (works over `file://` or any static HTTP server; zero build step or `npm install` required).
3. Use **`Cmd/Ctrl + K`** to focus the Smart Omnibox, or click any cell in the grid to inspect its exact `BigInt` rational numerator/denominator, bit length, SI dimensional vector `[m, s, kg]`, an[...]

---

## Scenario Workbooks

The selector includes ten additional educational workbooks (13 built-in workbooks in total), defined in `workbooks.js`:

| Workbook | Exact examples | Deliberate boundaries |
| --- | --- | --- |
| Drone Flight & Battery Budget | Cruise legs, reserve energy, endurance, exact planar wind magnitude, conversion round trips and normalized flight-time solving | Nonlinear drag, incompatible dime[...]
| Robotics Calibration & Timing | Encoder ratios, 97 Hz ticks, gears, actuator work and affine calibration | Trigonometric poses, transformation matrices and unit mismatch |
| Finance Exact Ledger & Goal-Seek | Decimal totals, thirds, tax reversal, compounding and integers beyond 2^53 | Unknown nonlinear rates and variable denominators |
| Physics Energy, Momentum & Dimensions | Kinetic and spring energy, exact speed from energy, pressure, volume conversion and dimensional cancellation | Irrational roots, unit-bearing equations an[...]
| Financial Risk & Stress Scenarios | A discrete loss distribution, a selected 95% VaR cutoff, worst-5% expected shortfall, credit losses, hedge sizing and portfolio variance | Irrational volatili[...]
| Precision & Guardrail Stress Lab | Large integers, repeating primes, terminating decimals and parser precedence | Fractional powers, exponent limits, nonlinear equations and incompatible dimensi[...]
| Exact Numbers & Numeric Boundaries | 30-digit integer arithmetic, tiny increments, exact repeating fractions, values above/below Excel’s native range, exact large square roots and SI tracking | A[...]
| Rocket Ascent & Exact Time Steps | Changing-mass Euler steps, thrust solving and a coast apex | Integration error, nonlinear solving and exponential atmosphere |
| Deep Decimals & Cancellation Audit | 100-place decimal, cancellation, unstable affine recurrence, prime ratios and SI energy | Float64 drift and incompatible dimensions |

| Linear Regression & Logistic Odds | Exact OLS slope/intercept, residuals, SSE, R², prediction and rational logistic odds | Logarithms, exponentials and iterative logistic fitting |

Select a row to read its explanation and expected Exact Auto output in the workbook guide. Amber boundary cells are intentional rejections. Unsupported, undefined and failed calculations display t[...]

The grid's **Wrap Text** toggle lets narrow cells wrap their contents and grow the row height. **Fit Columns** automatically sizes each column to its current displayed content and updates after in[...]

### Create a workbook

Click **New Workbook**, enter a name, and choose **Create Workbook** to start an empty A1:Z26 grid. Your named workbooks appear under **My workbooks** in the selector. Cell edits, cleared cells an[...]

Use **Export JSON** for a portable copy including the workbook name, raw formulas and custom unit definitions. Browser storage is local to this browser profile and site; it does not provide cloud [...]

To remove a saved workbook, select it under **My workbooks**, click **Delete Workbook**, and confirm its name. Deletion is permanent; export a copy first if needed. Built-in examples cannot be del[...]

### Rocket ascent example

Workbook 11 is inspired by the [Math.js rocket trajectory example](https://mathjs.org/examples/browser/rocket_trajectory_optimization.html.html). It follows three half-second explicit Euler steps[...]

### Linear regression and logistic odds

Workbook 13 fits a four-observation ordinary least-squares line using exact rational sufficient statistics. It calculates slope 0.8, intercept 1.5, residual sum of squares 1.8 and R² = 0.64, then predicts and solves backwards through the fitted line. Edit B2:C5 to refit the data. The sample count is fixed at four. Identical predictor values make the slope undefined; constant responses make R² undefined.

The logistic section uses **supplied** baseline probability 1/5 and odds ratio 3/2, calculating `p(x) = O₀ OR^x / (1 + O₀ OR^x)` for integer predictor steps. Probabilities are exact fractions (for example, 3/11 at x = 1). Valid baseline probabilities must lie strictly between zero and one, and odds ratios must be positive; these are input assumptions, not automatic statistical validation. Integer exponents remain limited to −10…10. This does not fit logistic regression coefficients: logarithms, exponentials, iterative maximum likelihood, standard errors and confidence intervals are outside the current engine. Boundary cells explain those limits.

### Verified exact arithmetic and Float64 comparisons

Workbook 12, **Deep Decimals & Cancellation Audit**, demonstrates exact rational arithmetic. Workbook 10, **Exact Numbers & Numeric Boundaries**, adds long integers, tiny increments and extreme magnitudes. The table below distinguishes documented Excel limits from JavaScript results measured with Node.js. JavaScript numbers and Excel numeric cells both use binary floating-point arithmetic, but input handling, evaluation order and Excel’s corrective behavior can differ; the JavaScript outputs below are not measurements from Excel.

Microsoft documents [15 significant digits of numeric precision](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits) and [Excel floating-point behavior and range limits](https://learn.microsoft.com/en-GB/office/troubleshoot/excel/floating-point-arithmetic-inaccurate-result). This is a limit on significant digits, not decimal places: a small value such as 10^-72 does not automatically round to zero.

| Scenario / workbook cell | Formula or procedure | Verified JavaScript Float64 result / Excel distinction | AliceMath exact result |
| --- | --- | --- | --- |
| 100-place decimal, Workbook 12 D3 | B2 = `(1/5)^10`; D2 = `B2^5`; D3 = `D2*D2*(1/2)^5` | Same JavaScript operation sequence: `3.9614081257132386e-72`, an approximation. Excel cannot retain all significant digits of the exact coefficient. | Exact `1/(5^100 * 2^5)`, terminating after **100 decimal places**; full expansion below. |
| Catastrophic cancellation, Workbook 12 D4 | `((1/3)*(10^8)^2-3333333333333333)*3` | JavaScript: `0`; the exact residual is lost during intermediate rounding. | `1` |
| Four-step unstable affine recurrence, Workbook 12 D9 | Start at `1/3`; apply `x = 10000*x - 3333` four times in one expression | JavaScript: `0.030168432742357254` after four steps. This is an unstable affine map, not bounded chaos. | `1/3` at every step |
| Prime harmonic remainder, Workbook 12 D10 | `solve x + 1/17 + 1/19 + 1/23 = 1` | JavaScript rearrangement: `0.8450666307713017`. Excel can use `=1-1/17-1/19-1/23` directly; Goal Seek or a macro is unnecessary. | `x = 6278/7429`; all shares sum to exactly `1` |
| Prime gear identity, Workbook 12 D11 | `(17/97)*(97/53)*(53/89)*(89/17)` | JavaScript: `1` for this order. This example does **not** demonstrate a floating-point error; other expressions may round differently. | `1` by exact rational cancellation |
| SI power to energy, Workbook 12 E12 | `convert ((3/7) kw)*(14 min) to kj` | JavaScript numeric equivalent `(3/7)*1000*14*60/1000` also gives `360`. Excel can compute the numeric result and has explicit unit conversion; ordinary numeric cells do not propagate SI dimensions. | `360 kj`; SI vector `[2, -2, 1]` |
| Tiny increment, Workbook 10 D3 | `1 + 0.00000000000000000001` | JavaScript: `1`, losing the increment. | `1.00000000000000000001` |
| Integer increment beyond 2^53 | `9007199254740992 + 1` | JavaScript: `9007199254740992`. Excel also has its documented 15-digit precision limit. | `9007199254740993` |
| Huge integer and tiny reciprocal, Workbook 10 D6/D7 | `2^4000` and `1/2^4000`, expressed with nested allowed powers | JavaScript: `Infinity` and `0`; Excel reports overflow for the huge power and cannot retain the tiny positive value in a native numeric cell. | Exact 1205-digit integer and exact positive reciprocal, within the 4096-bit budget |
| Dimensional guard, Workbook 12 D13 | `1 n + 1 w` | Adding ordinary numbers does not verify physical dimensions. | Rejected: incompatible force and power dimensions; a yellow cell comment explains why. |

The decimal’s full expansion is:

```text
0.0000000000000000000000000000000000000000000000000000000000000000000000039614081257132168796771975168
```

It has 100 digits after the decimal point, including leading zeros, and 29 significant digits. The denominator reduces to `2^5 * 5^100`, so 100 is the required terminating decimal length. A genuinely 105-place variant can be constructed with `D3 / 5^5`; that is a different value.

The measured recurrence values are `0.33333333333303017`, `0.3333333303016843`, `0.33330301684327424`, and `0.030168432742357254`. The proposed `0.25` and `-833` outputs do not match this four-step evaluation.

The app’s Float Drift view simulates arithmetic inside each **resolved cell expression**. References supply exact upstream values converted to Float64, rather than carrying a separate rounded spreadsheet state. Use Workbook 12 D9’s nested expression to see rounding propagate through all four steps. SI formulas, solver syntax and large typed reference tokens may fall back to conversion of the exact result; this view is not a full Excel emulator.

Excel offers [Goal Seek](https://support.microsoft.com/en-au/excel/use-goal-seek-to-find-the-result-you-want-by-adjusting-an-input-value), and simple linear equations can also be rearranged directly. AliceMath’s distinction here is automatic exact rational output with inline solving and SI tracking. These are comparisons with native numeric workflows; custom code, add-ins and other exact-arithmetic libraries can extend spreadsheets. They are not claims that these calculations are exclusive to AliceMath.

Measurement inputs are assumed exact within each simplified model; exact arithmetic does not imply exact real-world measurements. Finance rows use one assumed currency as dimensionless amounts an[...]

Implementation notes: converted results retain an exact `baseRational` SI magnitude for downstream references; `rational` continues to represent the displayed target-unit magnitude. Variable expo[...]

Run `node test-workbooks.cjs` from the application directory to verify the scenario results, cross-checks, conversion scale, linear-power guardrails, full-grid references compound Float64 compari[...]

## License & Required Attribution (Non-Commercial)

### Alice by San — Non-Commercial Attribution License (CC BY-NC 4.0)
