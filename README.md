# AliceGrid & Omnibox (`AliceMath`)

An exact rational, dimensionally-typed spreadsheet and natural-language omnibox powered by **`AliceMath`** (originating from **Alice by San**).

AliceMath combines **BigInt rational arithmetic**, **SI dimensional analysis (`[m, s, kg]`)**, and **single-variable linear solving** in a standalone engine with no runtime dependencies and no JavaScript `eval()`. Decimal and fractional inputs remain exact within explicit resource limits; the Float Drift view illustrates binary floating-point rounding.

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

AliceMath uses the same value type for rational constants, SI dimensions and affine expressions in one unknown. Four parts of the implementation explain how these features interact:

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
Because every intermediate value is an instance of `V`, the parser does not need a separate symbolic algebra pass or unit-checking pass. All mathematical laws and epistemic boundaries are enforced inline during the four basic arithmetic operations:

* **Addition & Subtraction (`V.add`)**:
  Checks `same(this.dim, v.dim)` first. Attempting to add `5 m + 3 kg` immediately halts with `"Addition requires compatible units."` Otherwise, it adds both the constant terms (`this.b ± v.b`) and linear $x$ coefficients (`this.a ± v.a`) in one step.
* **Multiplication (`V.mul`)**:
  Checks `!this.a.zero() && !v.a.zero()`. If both operands contain a non-zero $x$ coefficient (such as `x * x`), the product would become quadratic ($x^2$), so `V.mul` immediately halts with `"Only linear equations are supported."` Otherwise, it computes the linear binomial product $(a_1 x + b_1)(a_2 x + b_2) = (a_1 b_2 + a_2 b_1)x + b_1 b_2$ and adds the SI unit exponents `this.dim[i] + v.dim[i]`.
* **Division (`V.div`)**:
  Checks `!v.a.zero()` to prevent rational expressions with $x$ in the denominator (such as `1 / x`), divides the `BigInt` rationals exactly, and subtracts the SI unit exponents `this.dim[i] - v.dim[i]`.
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
* If the stripped denominator equals `1n`, `Q.text()` performs exact `BigInt` long division to output the exact decimal (up to 5,000 decimal places). If any other prime factor remains (e.g., `1/3` or `1/97`) or if the decimal exceeds 5,000 digits, it returns the exact reduced fraction `${this.n}/${this.d}` rather than rounding or fabricating precision.

### 4. Implicit Juxtaposition Binding Power in a Pratt Parser (`class Parser`)
Natural math expressions mix explicit operators (`2 * x + 3`) with implicit juxtaposition (`2x`, `500 km`, `3(x + 1)`). `AliceMath`’s `Parser` handles this in a single Pratt-style precedence loop without a preprocessor:
* Standard addition/subtraction (`+`, `-`) has binding power `10`.
* Explicit multiplication/division (`*`, `/`) has binding power `20`.
* Implicit juxtaposition (when the next token is a declared unit, `(`, or `x`) is assigned binding power `25`—tighter than `*` and `/`, but looser than exponentiation `^` (`30`) and `%` (`40`).
* As a result, `convert 500 w * 2 hr to kj` or `solve 2x + 3(x - 1) = 12` parses deterministically in a single pass with a strict 256-token / 32-depth recursion budget and zero dynamic code execution.

---

## Quick Start

1. Clone or download this repository.
2. Open `index.html` directly in any modern browser (works over `file://` or any static HTTP server; zero build step or `npm install` required).
3. Use **`Cmd/Ctrl + K`** to focus the Smart Omnibox, or click any cell in the grid to inspect its exact `BigInt` rational numerator/denominator, bit length, SI dimensional vector `[m, s, kg]`, and IEEE-754 float comparison.

---

## Approximate calculations (batch 2)

**Exact only** is the default. In **Calculation**, choose **Allow approximations ≈**, then select **20, 34, 50 or 100 significant digits**. Workbook 14 demonstrates the difference. Exact calculations still use the rational engine: `1/3`, `sqrt(9/16)` and exact linear equations do not become decimals just because fallback is enabled.

Approximate mode adds:

- `pi` or `π`, and `e` as decimal constants, not symbolic expressions.
- Irrational `sqrt(...)`, including quantities with even SI exponents, such as `sqrt(2 m^2)`.
- `exp(...)`, `ln(...)` and `log(...)`; both log names mean **natural logarithm**.
- `log10(...)` for an explicitly base-ten logarithm; existing `log(...)` remains natural logarithm for saved-formula compatibility.
- `sin(...)`, `cos(...)` and `tan(...)` with dimensionless arguments in **radians**.

Approximate outputs always begin with **≈**, even when the rounded display is an integer or zero. Dependent cells and SUM/AVG/PROD ranges carry typed decimal values and the approximation flag; they are never silently converted to exact fractions. Converted references reuse their underlying SI magnitude, not their displayed target-unit magnitude. Strict Fraction and Float Drift display choices retain ≈ for these results; they do not manufacture a rational or a new Float64 comparison.

The selected precision governs decimal computation and displayed significant digits, with 12 additional working guard digits and half-even rounding. **It is not a certified error bound**: cancellation and ill-conditioned expressions can lose meaningful digits. Increasing precision recalculates from raw formulas. No interval guarantees, symbolic simplification or exact identities are inferred from decimal results.

Dimension checking remains active. `exp(2 m)`, `sqrt(1 m)` and `sqrt(2 m^2) + 1 s` are rejected. Existing token, expression, depth, unit-exponent and integer-power guards remain; decimal magnitudes are also bounded to exponents −1233…1233, exponential arguments to absolute value 1000 and trigonometric arguments to 1,000,000 radians. Tangent is rejected at or too close to a pole at the current precision. Domain errors, overflow and underflow show calculation comments rather than invented finite results. Equations requiring approximate coefficients remain unsupported; the exact affine solver retains its existing scope.

Custom workbooks save their calculation mode and precision. Older saved workbooks load in Exact only mode. Built-in example settings and edits are retained for the current session. New workbooks start in Exact only mode. CSV output retains ≈; JSON exports include calculation settings and per-result `exact`, `approximate`, `precision`, decimal value, SI dimensions and rounding metadata. JSON restore/import is available through Import with a preview.

The adapter is [`alice-approx.js`](alice-approx.js), using the shared lexer, normalizer and Pratt parser exported by [`alice-math.min.js`](alice-math.min.js). Approximation uses [decimal.js 10.6.0](https://github.com/MikeMcl/decimal.js), bundled locally for offline use. Its npm archive integrity and vendored-file SHA-256 are recorded in [`vendor/decimal.provenance.json`](vendor/decimal.provenance.json). decimal.js retains its separate [MIT licence](vendor/decimal.LICENCE.md); the project licence below does not replace it.

## Scenario Workbooks

The selector includes twelve additional educational workbooks (15 built-in workbooks in total), defined in `workbooks.js`:

| Workbook | Exact examples | Deliberate boundaries |
| --- | --- | --- |
| Drone Flight & Battery Budget | Cruise legs, reserve energy, endurance, exact planar wind magnitude, conversion round trips and normalized flight-time solving | Nonlinear drag, incompatible dimensions and zero duration |
| Robotics Calibration & Timing | Encoder ratios, 97 Hz ticks, gears, actuator work and affine calibration | Trigonometric poses, transformation matrices and unit mismatch |
| Finance Exact Ledger & Goal-Seek | Decimal totals, thirds, tax reversal, compounding and integers beyond 2^53 | Unknown nonlinear rates and variable denominators |
| Physics Energy, Momentum & Dimensions | Kinetic and spring energy, exact speed from energy, pressure, volume conversion and dimensional cancellation | Irrational roots, unit-bearing equations and exponent budgets |
| Financial Risk & Stress Scenarios | A discrete loss distribution, a selected 95% VaR cutoff, worst-5% expected shortfall, credit losses, hedge sizing and portfolio variance | Irrational volatility and undefined coverage ratios |
| Precision & Guardrail Stress Lab | Large integers, repeating primes, terminating decimals and parser precedence | Fractional powers, exponent limits, nonlinear equations and incompatible dimensions |
| Exact Numbers & Numeric Boundaries | Long integers, tiny increments, repeating fractions, large/small exact values, square roots and SI tracking | Float64 overflow/underflow and dimensional guards |
| Rocket Ascent & Exact Time Steps | Changing-mass Euler steps, thrust solving and a coast apex | Integration error, nonlinear solving and exponential atmosphere |
| Deep Decimals & Cancellation Audit | 100-place decimal, cancellation, unstable affine recurrence, prime ratios and SI energy | Float64 drift and incompatible dimensions |
| Linear Regression & Logistic Odds | Exact OLS slope/intercept, residuals, SSE, R², prediction and rational logistic odds | Logarithms, exponentials and iterative logistic fitting |
| Exact Rounding & Fill-Down | Rational halfway rounding, negative floors, GCD/LCM, unit-aware averages and fixed references | Dimensionless exact inputs for scalar functions, integer-only GCD/LCM and approximate-input rejection |
| Irrationals & Decimal Precision | π/e, irrational roots, logs, trigonometry, a sigmoid and approximate SI references | Exact-only boundaries, dimension checks and approximate equation limits |

Select a row to read its explanation and expected Exact Auto output in the workbook guide. Amber boundary cells are intentional rejections. Unsupported, undefined and failed calculations display their resolved expression with a yellow corner comment marker. Hover, focus or click the marker to read the reason, resolved expression and original formula. Expected limits remain amber, while edited formulas producing unexpected errors remain red. If a reference cannot be resolved, the cell shows the remaining expression with that reference intact. Cross-check columns remain live formulas, so editing an input recalculates dependent rows.

The grid's **Wrap Text** toggle lets narrow cells wrap their contents and grow the row height. **Fit Columns** automatically sizes each column to its current displayed content and updates after input or number-format changes. Both toggles start off; with wrapping and fitting disabled, the original fixed-width, single-line ellipsis display is preserved. Comment markers can be opened by keyboard and dismissed with Escape or the close button.

### Create a workbook

Click **New Workbook**, enter a unique name, and choose **Create Workbook** to start an empty A1:Z26 grid. Your workbooks appear under **My workbooks** in the selector. Raw cell formulas and workbook-specific custom units are saved in this browser. Switching workbooks retains custom cells; edits to built-in examples last for the current session.

Use **Export JSON** for a portable copy containing the workbook name, raw formulas and custom units. Browser storage belongs to this site and browser profile; it does not provide cloud sync. If saving fails, the app retains session data and recommends exporting a copy. Use Import to restore an exported JSON workbook with its raw formulas, calculation settings, custom units and imported-formula comments.

To remove a saved workbook, select it under **My workbooks**, click **Delete Workbook**, and confirm its name. Deletion is permanent; export a copy first if needed. Built-in examples cannot be deleted. A failed storage write leaves the workbook intact.

### Rocket ascent example

Workbook 11 follows three half-second explicit Euler steps for a toy vertical rocket with changing mass, constant thrust and constant gravity. Its exact arithmetic removes rounding from the discrete model, not integration error or uncertainty in the inputs. The example omits atmospheric drag, staging, gravity turns and orbital optimization.

### Linear regression and logistic odds

Workbook 13 fits a four-observation ordinary least-squares line using exact rational sufficient statistics. It calculates slope 0.8, intercept 1.5, residual sum of squares 1.8 and R² = 0.64, then predicts and solves backwards through the fitted line. Edit B2:C5 to refit the data. The sample count is fixed at four. Identical predictor values make the slope undefined; constant responses make R² undefined.

The logistic section uses **supplied** baseline probability 1/5 and odds ratio 3/2, calculating `p(x) = O₀ OR^x / (1 + O₀ OR^x)` for integer predictor steps. Probabilities are exact fractions (for example, 3/11 at x = 1). Valid baseline probabilities must lie strictly between zero and one, and odds ratios must be positive; these are input assumptions, not automatic statistical validation. Integer exponents remain limited to −10…10. This does not fit logistic regression coefficients. Choose **Allow approximations** to evaluate logarithms, exponentials and a sigmoid as decimal calculations; iterative maximum likelihood, standard errors and confidence intervals remain unsupported.

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

Measurement inputs are assumed exact within each simplified model; exact arithmetic does not imply exact real-world measurements. Finance rows use one assumed currency as dimensionless amounts and retain pre-rounding fractions. Workbook 8 uses a one-period discrete distribution and a simplified undiscounted PD × LGD × EAD credit-loss model, with [BIS expected-loss terminology](https://www.bis.org/basel_framework/chapter/CRE/35.htm?inforce=20230101&published=20200327&tldate=19970826). Its [VaR and expected-shortfall examples](https://www.bis.org/committees/bcbs/basel-framework/standard/mar/10/inforce/2022-01-01/published/2019-12-15) explicitly select the 95% cutoff and allocate the worst 5% probability mass; they do not sort or reselect a quantile automatically if probabilities are edited. This is an educational scenario model rather than a calibrated regulatory risk system.

Implementation notes: converted results expose `baseRational` in SI and `rational` in displayed target units. References and ranges use `parseCoord` to validate against `COLS` and `ROWS`, including row limits above 500. Exact roots require nonnegative rational perfect squares and even SI exponents. Large references pass typed values instead of oversized numeric tokens. Raw input still has 100-character token and 2000-character expression limits, 256 tokens, depth 32, 4096-bit rationals and integer exponents −10…10.

Run `node test-workbooks.cjs` from the application directory to verify the scenario results, cross-checks, conversion scale, linear-power guardrails, full-grid references compound Float64 comparison, exact square roots, large rational references and Float64 boundary rounding.

## Spreadsheet functions, fill-down and accents (batch 4a)

Workbook 15, **Exact Rounding & Fill-Down**, demonstrates the new helpers. They run in the spreadsheet/omnibox adapter; AliceMath remains a standalone exact engine. Version 1.0.2 also shares its parser with the approximate adapter.

| Function | Behavior |
| --- | --- |
| `SUM(A1:B3)` | Adds one rectangular range; dimensions must be compatible. |
| `AVG(A1:B3)` / `AVERAGE(A1:B3)` | Exact mean of one rectangular range, with unit checking. |
| `PROD(A1:B3)` / `PRODUCT(A1:B3)` | Multiplies one rectangular range, combining dimensions. |
| `ROUND(value, places)` | Exact rational rounding, with halfway values **away from zero**. Places defaults to 0 and must be an integer −100…100; negative places round to powers of ten. |
| `FLOOR(value)` | Mathematical floor to an integer, including negative fractions. Takes **one argument**, not a significance argument. |
| `GCD(a, b, …)` / `LCM(a, b, …)` | Accept 1…32 exact dimensionless integers; ignore signs. Fractions are rejected rather than truncated. GCD of all zeros and any LCM containing zero return zero. |

Scalar ROUND/FLOOR/GCD/LCM helpers require **exact, dimensionless** inputs. They do not convert approximate results into exact values. To round a length to centimetres, explicitly normalize and restore its unit: `ROUND((1.234 m)/(1 cm),0)*(1 cm)` gives `1.23 m`. Rounding is an intentional change to the value: `ROUND(1/3,2)` is exactly `0.33`, while the original `1/3` remains exact in its source cell. Functions can be nested, such as `ROUND(AVERAGE(B2:B5),2)`, within the existing resource budgets. Range aggregates skip blank cells and text labels, including numeric-looking text. Zero is included in AVG’s numeric count. Real calculation errors and circular references propagate. Empty SUM/PROD ranges return zero; an AVG with no numeric cells reports `EMPTY_AVERAGE`. Direct arithmetic references to blank/text cells remain errors. Ranges fold typed values directly, avoiding the expression/token expansion limit while retaining SI dimensions, ≈ provenance and BigInt budgets. Float Drift retains a separate binary-float aggregate trace. IF, lookups and list/range arguments to GCD/LCM are still future work.

Click **Fill Down** to choose a source cell or rectangular block and a last destination row. The preview lists moved formulas and counts existing cells that will be replaced; a blank source clears its destinations. A multi-row source repeats its original pattern. Relative references move with each copy; `$A$1` stays fixed, `$A1` keeps its column and `A$1` keeps its row. Out-of-grid references reject the entire fill before any cells change. The fill, including imported-formula comments, is one undoable action.

For a quicker source selection, click one grid cell and **Shift-click** the opposite corner. Fill Down uses the rectangle’s first row and last selected row as defaults; its fields remain editable. **Cmd/Ctrl+D** opens the preview when focus is outside an input or select. This is formula/block copying; it does not infer a numeric series.

The **Accent** picker offers Purple (the current default), Ocean blue, Deep teal, Berry rose and Burnt amber. It changes buttons, links, selection highlights and coordinated backgrounds. Error, warning and approximate-result colours retain their meanings. The chosen accent is saved separately from workbook data in this browser; blocked storage keeps the selection for the current page session. Preset tests check at least **4.5:1** contrast for white button text, dark accent text on pale/selected backgrounds, and normal text on selected cells. This is a check of those colour pairs, not an accessibility certification of the entire app.

## Recovery and import (batch 3)

Use **Undo** and **Redo**, or **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z** and **Ctrl+Y**, for committed workbook edits. Native text undo remains available while editing an uncommitted input. Each workbook has its own history covering cell edits, Clear Grid, imports, custom-unit changes and calculation mode/precision changes. A bulk clear or import is one step. A new edit after undo discards redo. History retains up to **50 operations or 16 MiB per workbook**, whichever limit is reached first, and resets on reload. Adjacent history entries share serialized states; selection metadata is stored separately so selection changes do not duplicate a workbook snapshot. Workbook creation/deletion is outside this history; deletion still requires confirmation and remains permanent.

Custom unit definitions now belong to each workbook. Older browser saves with shared units are migrated by copying their definitions into each saved workbook. Changing or undoing a unit in one workbook cannot change another workbook’s definitions. New workbooks start with the standard unit registry. Mode, raw cells, custom units and formula comments persist in browser storage; history itself does not.

Click **Import**, choose a `.json`, `.csv` or `.xlsx` file, and review the preview before applying it. Imports create a **new workbook** by default; **Replace current grid** is an explicit alternative and is undoable. Names must be unique. Cancellation or invalid data leaves the current workbook unchanged. The preview shows the first eight rows and six columns, cell counts, settings and warnings. Import refuses populated cells outside the current grid instead of silently truncating them.

- **JSON:** restores AliceMath `alice.grid-workbook/v1` exports, including exact raw formula strings, custom units, calculation settings and unsupported-formula comments. Cached evaluated outputs are ignored and formulas are recalculated. Older exports without settings default to Exact only.
- **CSV:** supports UTF-8/BOM, comma/semicolon/tab auto-detection, quoted delimiters, escaped quotes and quoted newlines. Choose whether to evaluate fields beginning with `=` and whether to keep numeric-looking fields as text. CSV has no embedded units/settings. New CSV workbooks use standard units and Exact only mode; replacement retains the destination’s units and settings. **CSV values · safe text** exports displayed values and protects formula-like text using a tab prefix inside quoted fields; genuine negative numeric results remain numeric. The prefix becomes part of the CSV data and protection can vary across spreadsheet applications. **CSV raw formulas · executable** explicitly exports raw cell strings instead. CSV cannot preserve unit definitions, calculation settings or formula comments; JSON is the complete workbook format.
- **XLSX:** select one source worksheet per import. Numeric cells reflect the source file’s floating-point precision; text cells, including long identifiers and formula-looking strings, remain literal text. Dates become ISO text and booleans become TRUE/FALSE labels. Formatting, charts, merged layout and macros are not restored. Other worksheets can be imported separately.

Supported XLSX arithmetic formulas are recalculated by AliceMath. Rectangular `SUM` ranges are supported; `AVERAGE` becomes `AVG`, `PRODUCT` becomes `PROD`, `PI()` becomes `pi`, and absolute reference markers (`$A$1`, `$A1`, `A$1`) are preserved for fill-down. Scientific numeric literals retain their digits and are parsed exactly by the shared lexer, without passing formula literals through Float64. ROUND, GCD, LCM, INT, LOG10, SQRT, EXP, LN, SIN, COS and TAN are recognized, with the current exact/approximate mode determining whether a result is available. Aggregates currently require one rectangular range. ROUND/GCD/LCM imports use explicit EXCELROUND/EXCELGCD/EXCELLCM compatibility helpers: fractional integer arguments are truncated; negative GCD/LCM arguments and Excel’s documented 2^53 boundaries report errors. The native exact GCD/LCM functions still accept negative integers by absolute value, reject fractions and retain their larger BigInt range. INT maps to one-argument FLOOR. Excel’s significance-based FLOOR remains flagged. Compatibility helpers retain the app’s 32-argument, exact-input and rounding-place budgets.

Unsupported XLSX functions, source errors, external/cross-sheet references, arrays, named ranges, comparisons, ambiguous power expressions Excel space-intersection/implicit-multiplication syntax, and Excel LOG calls are preserved with a yellow cell comment explaining the limit. Cached numeric answers are never substituted for those formulas. Excel LOG is flagged because its default base differs from AliceMath’s natural logarithm. Editing a flagged cell clears its import comment; undo restores it. JSON export/restore retains the comments.

Import limits are **2 MiB per file**, **2000 raw text characters per cell**, and the configured grid bounds (currently A1:Z26). XLSX archives are checked before parsing: at most 4096 archive entries, **16 MiB actual decompressed bytes per entry** and **32 MiB actual total**; encrypted/ZIP64/multi-disk archives are unsupported. Headers, paths, overlapping entries, declared-versus-actual lengths and CRC32 checksums are validated. Streaming decompression stops at the first breached bound. The worker rebuilds a stored ZIP before SheetJS reads it, so SheetJS never inflates the original unvalidated data. Decompression and parsing share a ten-second worker timeout. XLSX requires HTTPS/localhost, a Worker and native streaming `deflate-raw` support. The unsafe main-thread fallback is removed; JSON/CSV still work over `file://`. No file contents are sent to a remote service.

XLSX parsing uses a locally bundled [SheetJS CE 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/standalone/) loaded only when needed. The official CDN source and SHA-256 hashes are recorded in [`vendor/xlsx.provenance.json`](vendor/xlsx.provenance.json); its separate [Apache-2.0 licence](vendor/xlsx.LICENSE) remains intact.

## Saving, cross-tab conflicts and legacy units

Custom workbooks use individual `alice.workbook/v2/<id>` records, not a rewritten all-workbook document. Edits are coalesced for 150 ms; only changed workbooks are written. A Web Lock serializes each workbook’s revision check and write across tabs. Web Locks require a supporting secure-context browser (HTTPS/localhost recommended); otherwise the workbook stays in memory with an Export JSON notice rather than using an unsafe write path.

The original v1 store is retained as a migration backup. Existing books migrate lazily; revisioned deletion tombstones prevent deleted legacy books reappearing. A failed save leaves its revision and local edits intact. Later edits retry, and **Retry Save** retries explicitly; a successful save clears the warning. A restore failure is kept read-only until reload, so unread stored data cannot be overwritten by a fresh session. “Changes waiting to save” and “Saving…” distinguish pending work from saved data. Uncommitted text retains native editing behavior; closing with pending committed changes triggers the browser’s unsaved-changes prompt where supported.

A `storage` event detects external changes. Revision checks also protect against overwrites if an event is delayed or missed. Conflicting local cells are retained. **Save Conflict Copy** preserves them, including a pending formula-bar draft, in a separate workbook while retaining the other tab’s saved version. **Load Saved Version** asks before replacing local cells/drafts and clearing that workbook’s history. Browser storage remains local to the origin/profile; it is not cloud backup.

New unit definitions in both the UI and JSON import use the engine’s single reserved-name list, including constants and function names. Existing browser workbooks with colliding names retain their old definitions and receive a visible warning. **Rename Legacy Unit** moves the definition and matching formula names together as one undoable operation; labels are unchanged. Rename collisions before exporting a JSON copy intended for re-import. Imported JSON cannot bypass this validation with a legacy flag.

## Parser conventions and API errors

Exact and decimal calculations share one lexer, normalization function and Pratt parser, parameterized by their number domain. Exact `V` arithmetic and decimal approximation remain separate domains. Approximate fallback checks stable diagnostic **codes**, not message wording.

- `1/2 m` means `1/(2 m)` and has dimension `m^-1`. Write `(1/2) m` for half a metre. Workbook 9 demonstrates this distinction.
- `1e5`, `.5e-3` and other bounded scientific literals work in the grid, omnibox and imported formulas. Scientific exponents are bounded to absolute value 1233, with the 4,096-bit rational budget still enforced on the result.
- `ln` and `log` mean natural logarithm; `log10` explicitly means base ten. Existing `log` workbooks retain their meaning; imported Excel LOG stays flagged because its default base is ten and optional-base syntax differs.
- AliceMath 1.0.2 returns division by zero as `{status:'error', code:'DIVISION_BY_ZERO', text:'undefined', exact:false}` with no numeric value. This intentionally replaces the old `status:'result'` contract. Other failures carry stable codes such as `TOKEN_BUDGET`, `NUMERIC_BUDGET`, `UNIT_MISMATCH` and `UNKNOWN_SYMBOL`.
- Exact BigInt arithmetic is resource-bounded: reduced numerators and denominators are capped at 4,096 bits. The footer now exposes this limit; the 2,000-character, 100-character-token, 256-token, depth-32 and SI-exponent budgets remain.

## Correctness checks and benchmarks

The browser app needs no build step or installation. The exact engine remains standalone; approximate mode uses a bundled, pinned copy of decimal.js. Developer checks use Node.js 22+ and Python 3.10+ with standard libraries only; there is no `npm install` or `pip install` step. Run from the repository directory:

```sh
node test-workbooks.cjs
node tests/test_approx.cjs
node tests/test_recovery_import.cjs
node tests/test_spreadsheet_tools.cjs
node tests/test_corrections.cjs
python3 tests/test_corrections_reference.py --output .test-results/corrections-reference.json
python3 tests/test_spreadsheet_reference.py --output .test-results/spreadsheet-reference.json
python3 tests/test_approx_reference.py --output .test-results/approx-reference.json
python3 -m unittest discover -s tests -p test_harness.py
python3 tests/test_reference.py --output .test-results/reference.json
```

- **93 corrective regressions** cover full-grid folding, blank/text/error behavior, native and Excel-compatible function semantics, reserved-name migration, shared syntax/error codes, CSV protection, bounded ZIP decompression, history sharing, quota retry and two-tab conflict recovery. **395 independent corrective-reference cases** use Python Fraction/Decimal/math for aggregates, scientific literals, imported functions and log10.
- **69 spreadsheet helper/controller checks** cover nested functions, bounds, fixed/relative references, atomic fills, undo/redo, imported comments and palette persistence/contrast. **566 independent Python Decimal/Fraction/math cases** verify ROUND, FLOOR, GCD and LCM.
- **381 workbook/controller checks** cover scenario outputs, references, units, storage, comments and Float64 boundaries. This is a headless controller suite, not a browser accessibility or end-to-end UI suite.
- **1,128 independent-reference cases** compare AliceMath with Python `fractions.Fraction`: 500 arithmetic expressions; 100 each of powers, affine solves, exact square roots, conversions, decimal inputs and derived dimensions; four large-value cases; and 24 fixed regression/guardrail fixtures. Rational values are compared as exact reduced numerator/denominator pairs, never with a float tolerance. Conversion checks verify both target-unit and SI magnitudes. Decimal strings are generated independently using integer arithmetic.
- **45 approximate engine/controller checks** cover precision, exactness provenance, dependent references/ranges, SI conversions, mode changes, exports, saved settings and retained guards. **648 independent approximate-reference cases** compare all four precisions with Python Decimal sqrt/exp/ln, independently computed Machin π and Taylor sin/cos. These well-conditioned cases compare rounded significant digits exactly, without using binary float as the oracle. See [`tests/approx-reference-baseline.json`](tests/approx-reference-baseline.json).
- **53 recovery/import checks** cover undo/redo and bounds, JSON round-trips, CSV quoting and text controls, real XLSX binaries, formula normalization/comments, atomic replacement, literal data and per-workbook unit isolation.
- **Six harness checks** verify that incorrect values, dimensions, normalization, IDs and missing results are detected, and that the seed reproduces inputs.

The corrective reference suite uses fixed seed `61017`; the spreadsheet-function suite uses fixed seed `17329`. The original exact and approximate reference suites use seed `20261016` by default; `--seed 123` selects another deterministic dataset. The JSON report records runtime versions, case groups, dataset and engine SHA-256 hashes, and every mismatch. A mismatch exits with status 1; a runner/setup error exits with status 2. Pass `--node /path/to/node` or `--engine /path/to/alice-math.min.js` when testing another runtime/build. Fixed cases live in [`tests/regressions.json`](tests/regressions.json). The recorded initial results are in [`tests/reference-baseline.json`](tests/reference-baseline.json).

For timing, run the separate command:

```sh
python3 tests/benchmark.py --output .test-results/benchmark.json
```

Benchmarks run only after the independent correctness suite passes. They measure parsing, exact calculation and formatting inside `AliceMath.calculate`; they exclude Python oracle generation, Node startup, JSON transport and browser/grid rendering. They do not compare Python and JavaScript speed. See [`benchmarks/README.md`](benchmarks/README.md) for methodology, raw samples and the recorded local baseline. The [1.0.2 timing sample](benchmarks/corrections-baseline.json) and [exact-reference report](tests/reference-v1.0.2-baseline.json) describe the shared-parser release; original baselines remain historical records. Passing finite tests is evidence for the covered cases, not a proof of correctness for every expression.

[`.github/workflows/correctness.yml`](.github/workflows/correctness.yml) runs the checks for Node 22/24 and Python 3.12/3.14 on pushes, pull requests and manual dispatch. Reports are uploaded as Actions artifacts; one matrix job also collects a non-gating timing sample. The workflow takes effect after these files are added to the GitHub repository. A configured workflow is not evidence of a successful remote CI run.

## Development roadmap

Batches are handled individually. Completing a batch does not enable the next one automatically.

| Batch | Scope | Status / completion criteria |
| --- | --- | --- |
| 1 | Correctness baseline | Added: independent Python reference checks, fixed regressions, harness checks, CI workflow, reproducible timing report and repaired documentation. Local checks pass; remote CI awaits a repository push. |
| 2 | Irrationals and approximate calculations | Added: explicit 20/34/50/100-digit decimal fallback, constants/functions, ≈ provenance through references/exports, retained dimensions, per-workbook settings, Workbook 14 and independent decimal reference checks. Exact engine was unchanged in that batch; shared syntax arrived in the corrective release. |
| 3 | Recovery and import | Added: per-workbook undo/redo, JSON restore, CSV and XLSX preview/import, unsupported-formula comments and isolated custom units. Histories are session-only; source formats do not import formatting/charts/macros. |
| 4a | Spreadsheet functions and fill-down | Added: AVERAGE/PRODUCT aliases, exact ROUND/FLOOR/GCD/LCM, nested arguments, previewed block fill, relative/absolute references, Workbook 15 and five saved accent palettes. Local checks pass; remote CI awaits a repository push. |
| Corrections | Calculation/import, storage/file handling, parser/API consistency | Completed: typed range folding, safe import semantics, reserved-name migration, bounded worker decompression, safe/raw CSV modes, revisioned per-workbook persistence, shared history states and shared exact/decimal syntax. |
| 4b | Dependency inspection and diagnostics | Next: inspect precedent/dependent cells and explain circular paths; preserve current calculation behavior and import comments. |
| Later batches | Scientific and spreadsheet expansion | Planned individually: seven SI base dimensions, affine temperatures, IF/lookups, charts and broader solving. |

## License & Required Attribution (Non-Commercial)

### Alice by San — Non-Commercial Attribution License (CC BY-NC 4.0)

Copyright © 2026 **Alice by San** (Sanjaya Khanal). All rights reserved under the terms below.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software, mathematical engine (`AliceMath`), and associated documentation files (the "Software"), to **use, copy, modify, merge, publish, and distribute** the Software for **non-commercial, educational, academic, personal, or research purposes**, subject to the following conditions:

1. **Mandatory Attribution**:
   You must give appropriate credit to **Alice by San** in all copies, forks, derivative works, user interfaces, and documentation by retaining the copyright notice above and linking to the original source repository.
2. **Non-Commercial Use Only**:
   You may **not** use the Software, or any derivative works thereof, primarily for commercial advantage, monetary compensation, paid SaaS hosting, or commercial product bundling without prior written permission from the author.
3. **No Warranty**:
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

For full legal text of the Creative Commons Attribution-NonCommercial 4.0 International Public License, see [https://creativecommons.org/licenses/by-nc/4.0/](https://creativecommons.org/licenses/by-nc/4.0/).
