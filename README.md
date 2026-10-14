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

The selector includes seven additional educational workbooks, defined in `workbooks.js`:

| Workbook | Exact examples | Deliberate boundaries |
| --- | --- | --- |
| Drone Flight & Battery Budget | Cruise legs, reserve energy, endurance, exact planar wind magnitude, conversion round trips and normalized flight-time solving | Nonlinear drag, incompatible dime[...]
| Robotics Calibration & Timing | Encoder ratios, 97 Hz ticks, gears, actuator work and affine calibration | Trigonometric poses, transformation matrices and unit mismatch |
| Finance Exact Ledger & Goal-Seek | Decimal totals, thirds, tax reversal, compounding and integers beyond 2^53 | Unknown nonlinear rates and variable denominators |
| Physics Energy, Momentum & Dimensions | Kinetic and spring energy, exact speed from energy, pressure, volume conversion and dimensional cancellation | Irrational roots, unit-bearing equations an[...]
| Financial Risk & Stress Scenarios | A discrete loss distribution, a selected 95% VaR cutoff, worst-5% expected shortfall, credit losses, hedge sizing and portfolio variance | Irrational volatili[...]
| Precision & Guardrail Stress Lab | Large integers, repeating primes, terminating decimals and parser precedence | Fractional powers, exponent limits, nonlinear equations and incompatible dimensi[...]
| Beyond Excel’s Native Numbers | 30-digit integer arithmetic, tiny increments, exact repeating fractions, values above/below Excel’s native range, exact large square roots and SI tracking | A[...]

Select a row to read its explanation and expected Exact Auto output in the workbook guide. Amber boundary cells are intentional rejections. Unsupported, undefined and failed calculations display t[...]

The grid's **Wrap Text** toggle lets narrow cells wrap their contents and grow the row height. **Fit Columns** automatically sizes each column to its current displayed content and updates after in[...]

### Create a workbook

Click **New Workbook**, enter a name, and choose **Create Workbook** to start an empty A1:Z26 grid. Your named workbooks appear under **My workbooks** in the selector. Cell edits, cleared cells an[...]

Use **Export JSON** for a portable copy including the workbook name, raw formulas and custom unit definitions. Browser storage is local to this browser profile and site; it does not provide cloud [...]

To remove a saved workbook, select it under **My workbooks**, click **Delete Workbook**, and confirm its name. Deletion is permanent; export a copy first if needed. Built-in examples cannot be del[...]

### Rocket ascent example

Workbook 11 is inspired by the [Math.js rocket trajectory example](https://mathjs.org/examples/browser/rocket_trajectory_optimization.html.html). It follows three half-second explicit Euler steps[...]

### What differs from Excel

Workbook 10 compares AliceMath with Excel's ordinary worksheet numeric engine. Microsoft documents [15-digit numeric precision and finite numeric limits](https://support.microsoft.com/en-us/excel[...]

The examples also show exact fractional linear solving and SI dimension tracking. Excel's [CONVERT](https://support.microsoft.com/en-us/excel/functions/convert-function) and [Goal Seek](https://s[...]

Math.js already supports [Fractions](https://mathjs.org/docs/datatypes/fractions.html), [fractional unit values](https://mathjs.org/docs/datatypes/units.html), and [Complex and Matrix types](http[...]

Measurement inputs are assumed exact within each simplified model; exact arithmetic does not imply exact real-world measurements. Finance rows use one assumed currency as dimensionless amounts an[...]

Implementation notes: converted results retain an exact `baseRational` SI magnitude for downstream references; `rational` continues to represent the displayed target-unit magnitude. Variable expo[...]

Run `node test-workbooks.cjs` from the application directory to verify the scenario results, cross-checks, conversion scale, linear-power guardrails, full-grid references compound Float64 compari[...]

## License & Required Attribution (Non-Commercial)

### Alice by San — Non-Commercial Attribution License (CC BY-NC 4.0)

Copyright © 2026 **Alice by San** (Sanjaya Khanal). All rights reserved under the terms below.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software, mathematical engine (`AliceMath`), and associated documentation files (the "Software"), to **use, co[...]