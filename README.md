# AliceGrid & Omnibox (`AliceMath`)

An exact rational, dimensionally-typed spreadsheet and natural-language omnibox powered by **`AliceMath`** (originating from **Alice by San**).

Unlike standard JavaScript calculators and spreadsheets that rely on 64-bit IEEE-754 floating-point numbers (where `0.1 + 0.2 === 0.30000000000000004`) or separate libraries for fractions, physical units, and computer algebra, `AliceMath` unifies **arbitrary-precision `BigInt` rationals**, **SI dimensional analysis (`[m, s, kg]`)**, and **single-variable linear equation solving (`solve for x`)** inside a zero-dependency ~2.5 KB engine with **zero `eval()`**.

---
# Demo: AliceGrid &amp; Omnibox · Exact Rational &amp; Dimensional Spreadsheet

---

## What is Different in AliceMath’s Architecture

In traditional mathematical software (such as `Math.js`, Python’s `SymPy` + `Pint`, or spreadsheet engines), **rational numbers**, **physical units**, and **algebraic polynomials** live in completely separate object hierarchies. Combining them usually requires heavy AST rewriting or complex type coercion.

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

## Scenario Workbooks

The selector includes seven additional educational workbooks, defined in `workbooks.js`:

| Workbook | Exact examples | Deliberate boundaries |
| --- | --- | --- |
| Drone Flight & Battery Budget | Cruise legs, reserve energy, endurance, exact planar wind magnitude, conversion round trips and normalized flight-time solving | Nonlinear drag, incompatible dimensions and zero duration |
| Robotics Calibration & Timing | Encoder ratios, 97 Hz ticks, gears, actuator work and affine calibration | Trigonometric poses, transformation matrices and unit mismatch |
| Finance Exact Ledger & Goal-Seek | Decimal totals, thirds, tax reversal, compounding and integers beyond 2^53 | Unknown nonlinear rates and variable denominators |
| Physics Energy, Momentum & Dimensions | Kinetic and spring energy, exact speed from energy, pressure, volume conversion and dimensional cancellation | Irrational roots, unit-bearing equations and exponent budgets |
| Financial Risk & Stress Scenarios | A discrete loss distribution, a selected 95% VaR cutoff, worst-5% expected shortfall, credit losses, hedge sizing and portfolio variance | Irrational volatility and undefined coverage ratios |
| Precision & Guardrail Stress Lab | Large integers, repeating primes, terminating decimals and parser precedence | Fractional powers, exponent limits, nonlinear equations and incompatible dimensions |
| Beyond Excel’s Native Numbers | 30-digit integer arithmetic, tiny increments, exact repeating fractions, values above/below Excel’s native range, exact large square roots and SI tracking | Automatic unit rejection and explicit Float64 overflow/underflow comments |

Select a row to read its explanation and expected Exact Auto output in the workbook guide. Amber boundary cells are intentional rejections. Unsupported, undefined and failed calculations display their resolved expression with a yellow corner comment marker. Hover, focus or click the marker to read the reason, resolved expression and original formula. Expected limits remain amber, while edited formulas producing unexpected errors remain red. If a reference cannot be resolved, the cell shows the remaining expression with that reference intact. Cross-check columns remain live formulas, so editing an input recalculates dependent rows.

The grid's **Wrap Text** toggle lets narrow cells wrap their contents and grow the row height. **Fit Columns** automatically sizes each column to its current displayed content and updates after input or number-format changes. Both toggles start off; with wrapping and fitting disabled, the original fixed-width, single-line ellipsis display is preserved. Comment markers can be opened by keyboard and dismissed with Escape or the close button.

### Create a workbook

Click **New Workbook**, enter a name, and choose **Create Workbook** to start an empty A1:Z26 grid. Your named workbooks appear under **My workbooks** in the selector. Cell edits, cleared cells and custom unit definitions are saved in this browser, and the selected workbook is restored on reload. Switching workbooks retains each custom workbook's cells; edits to example workbooks are retained for the current session. Custom workbooks use the same formula engine, omnibox, comments, display modes and text-layout controls as examples.

Use **Export JSON** for a portable copy including the workbook name, raw formulas and custom unit definitions. Browser storage is local to this browser profile and site; it does not provide cloud sync. If browser storage is unavailable or full, the app keeps the workbook in the current session and shows an Export JSON fallback message. Invalid saved data is not overwritten automatically.

To remove a saved workbook, select it under **My workbooks**, click **Delete Workbook**, and confirm its name. Deletion is permanent; export a copy first if needed. Built-in examples cannot be deleted. A failed storage write leaves the workbook intact, and deleting the final workbook saves an empty collection so it cannot return after reload.

### Rocket ascent example

Workbook 11 is inspired by the [Math.js rocket trajectory example](https://mathjs.org/examples/browser/rocket_trajectory_optimization.html.html). It follows three half-second explicit Euler steps for a toy vertical rocket with changing mass, constant thrust and constant gravity. Its formulas preserve exact rational values and SI dimensions, include a thrust goal-seek and a coast apex, and expose nonlinear/exponential boundaries. Exact discrete arithmetic does not remove integration error or uncertainty in physical assumptions. This workbook omits atmospheric drag, staging, gravity turns and orbital trajectory optimization.

### What differs from Excel

Workbook 10 compares AliceMath with Excel's ordinary worksheet numeric engine. Microsoft documents [15-digit numeric precision and finite numeric limits](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits), with [floating-point overflow, underflow and rounding behavior](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/excel/floating-point-arithmetic-inaccurate-result). AliceMath can retain an exact 30-digit integer plus one, 1 + 10^-20, 1/97 as a rational, 2^4000, and 1/2^4000 within its 4096-bit budget. Its Float64 display flags both overflow and underflow, so a nonzero exact result is not silently presented as zero.

The examples also show exact fractional linear solving and SI dimension tracking. Excel's [CONVERT](https://support.microsoft.com/en-us/excel/functions/convert-function) and [Goal Seek](https://support.microsoft.com/en-au/excel/use-goal-seek-to-find-the-result-you-want-by-adjusting-an-input-value) remain useful; inline solve syntax and units carried through arithmetic are workflow/type-system differences. This is not a claim that Excel with custom code, add-ins or other numeric engines cannot perform equivalent computations. Long example results have a short description in the workbook guide and can be inspected in Exact Auto or Strict Fraction.

Math.js already supports [Fractions](https://mathjs.org/docs/datatypes/fractions.html), [fractional unit values](https://mathjs.org/docs/datatypes/units.html), and [Complex and Matrix types](https://mathjs.org/docs/datatypes/index.html). These examples compare AliceMath's exact-by-default scalar workflow with default Number arithmetic and describe the configuration or function support available in Math.js. They do not claim that rational arithmetic, unit conversion or risk calculations are impossible in Math.js.

Measurement inputs are assumed exact within each simplified model; exact arithmetic does not imply exact real-world measurements. Finance rows use one assumed currency as dimensionless amounts and retain pre-rounding fractions. Workbook 8 uses a one-period discrete distribution and a simplified undiscounted PD × LGD × EAD credit-loss model, with [BIS expected-loss terminology](https://www.bis.org/basel_framework/chapter/CRE/35.htm?inforce=20230101&published=20200327&tldate=19970826). Its [VaR and expected-shortfall examples](https://www.bis.org/committees/bcbs/basel-framework/standard/mar/10/inforce/2022-01-01/published/2019-12-15) explicitly select the 95% cutoff and allocate the worst 5% probability mass; they do not sort or reselect a quantile automatically if probabilities are edited. This is an educational scenario model rather than a calibrated regulatory risk system.

Implementation notes: converted results retain an exact `baseRational` SI magnitude for downstream references; `rational` continues to represent the displayed target-unit magnitude. Variable exponents are rejected, while x^0 and x^1 follow the engine's zero-power and linear-power rules. References and ranges cover A1:Z26. Exact `sqrt(expression)` is supported for nonnegative rational perfect squares with even SI exponents. Irrational roots, trigonometry, matrices and nonlinear equations remain unsupported. Large cached rational references pass as validated V values instead of being reparsed as oversized numeric strings, while raw input retains the 100-character token and 2000-character expression limits. Float64 conversion uses binary rounding with ties to even to handle large numerator/denominator ratios without Infinity/Infinity intermediates. Malformed rational scales are rejected. The 4096-bit numeric budget and integer-power limits still apply.

Run `node test-workbooks.cjs` from the application directory to verify the scenario results, cross-checks, conversion scale, linear-power guardrails, full-grid references compound Float64 comparison, exact square roots, large rational references and Float64 boundary rounding.

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
