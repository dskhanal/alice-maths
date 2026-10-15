'use strict';

// Educational scalar models. Measurement inputs are assumed exact for each example.
// Fields: scenario, input A, input B, result formula, cross-check, explanation, expected result, optional short expected-result description.
const SCENARIO_WORKBOOKS = {
  drone: {
    title: 'Workbook 4 · Drone Flight & Battery Budget',
    summary: 'Follow a constant-speed mission from mixed-unit legs to battery reserve and a dimensionless flight-time solve. These are simplified flight models.',
    rows: [
      ['Outbound cruise', '=13 m/s', '=6 min', '=B2*C2', '=convert D2 to km', 'Constant speed × duration; 4.68 km exactly.', '4680 m'],
      ['Return cruise', '=10 m/s', '=7 min', '=B3*C3', '=convert D3 to km', 'A slower return leg uses the same SI dimensions.', '4200 m'],
      ['Mission distance', '=D2', '=D3', '=B4+C4', '=convert D4 to km', 'Adding distances preserves metres; conversion is a view.', '8880 m'],
      ['Battery energy', '=120 w', '=18 min', '=B5*C5', '=convert D5 to kj', 'Constant power model: energy = power × time.', '129600 m^2 * s^-2 * kg'],
      ['Reserve energy', '=D5', '=25%', '=B6*C6', '=convert D6 to kj', '25% reserve is an exact rational multiplier.', '32400 m^2 * s^-2 * kg'],
      ['Usable endurance', '=D5-D6', '=120 w', '=B7/C7', '=convert D7 to min', 'No charge, voltage or battery chemistry model is assumed.', '810 s'],
      ['Conversion round trip', '=E2', '=1 m', '=convert B8 to m', '=D8-D2', 'A converted-cell reference must retain its original physical scale.', '4680 m'],
      ['Clock tick drift', '=0.1 s', '=0.2 s', '=B9+C9', '=convert D9 to ms', 'Exact 300 ms; inspect the SI dimension and rational fraction.', '0.3 s'],
      ['Solve cruise seconds', '=B2/(1 m/s)', '=D2/(1 m)', '=solve B10*x=C10', '=D10*1 s', 'Normalize units, solve one scalar x, then restore seconds.', 'x = 360'],
      ['Planar wind magnitude', '=3 m/s', '=4 m/s', '=sqrt(B11^2+C11^2)', '=convert D11 to m/s', 'An exact square root recovers the 5 m/s magnitude of two perpendicular scalar components.', '5 m * s^-1'],
      ['Unit mismatch guard', '=5 m', '=2 s', '=B12+C12', '', 'Expected rejection: distance + duration has no compatible dimension.', 'Addition requires compatible units.'],
      ['Nonlinear drag guard', 'speed-dependent drag', 'solve quadratic', '=solve x*x=4', '', 'Expected rejection: only affine equations are supported.', 'Only linear equations are supported.'],
      ['Zero-time guard', '=10 m', '=0 s', '=B14/C14', '', 'Zero duration produces undefined rather than an invented speed.', 'undefined']
    ]
  },
  robotics: {
    title: 'Workbook 5 · Robotics Calibration & Timing',
    summary: 'Exact encoder ratios, rational tick periods, actuator work and scalar calibration. Trigonometric poses and transformation matrices appear as explicit boundaries.',
    rows: [
      ['Encoder travel per tick', '=0.32 m', '=2048', '=B2/C2', '=convert D2 to mm', 'Assumed exact 0.32 m travel per revolution, not a circumference inferred from π.', '0.00015625 m'],
      ['Encoder displacement', '=D2', '=1536', '=B3*C3', '=convert D3 to mm', '1536 ticks correspond to 240 mm exactly.', '0.24 m'],
      ['Control-loop tick', '=1 s', '=97', '=B4/C4', '=D4*97', 'A 97 Hz period remains a rational rather than a rounded decimal.', '(1/97) s'],
      ['Average tick velocity', '=D3', '=D4*97', '=B5/C5', '=convert D5 to cm/s', 'The exact period cancels back to a one-second observation.', '0.24 m * s^-1'],
      ['Gear ratio', '=17', '=53', '=B6/C6', '=D6*C6', 'Prime-tooth ratios retain their denominator.', '17/53'],
      ['Reduced shaft rate', '=120 hz', '=D6', '=B7*C7', '=D7/B7', 'Frequency carries s^-1; gear ratios are dimensionless.', '(2040/53) s^-1'],
      ['Actuator work', '=25 n', '=4 m', '=B8*C8', '=convert D8 to kj', 'Force × travel yields joules in the SI dimension tuple.', '100 m^2 * s^-2 * kg'],
      ['Converted work reuse', '=E8', '=20 s', '=B9/C9', '=convert D9 to w', 'Reusing 0.1 kJ must give 5 W, not 0.005 W.', '5 m^2 * s^-3 * kg'],
      ['Calibration gain', '=3/5', '=1/10', '=solve B10*x+C10=1', '=B10*D10+C10', 'Exact slope and offset solve x = 3/2.', 'x = 1.5'],
      ['Tick totals', '=1536', '=512', '=SUM(B11:C11)', '=D11*D2', 'Spreadsheet range sum feeds a physical displacement.', '2048.0'],
      ['Pose trig boundary', 'joint angle', 'cosine', '=cos(1/3)', '', 'Inspect the exact result and its rational representation.', 'Unsupported expression'],
      ['Transform boundary', 'homogeneous transform', 'matrix', '=[1,0;0,1]', '', 'Inspect the exact result and its rational representation.', 'Unsupported expression'],
      ['Joint-unit guard', '=1 m', '=1 kg', '=B14+C14', '', 'Expected rejection: mass and travel cannot be added.', 'Addition requires compatible units.']
    ]
  },
  finance: {
    title: 'Workbook 6 · Finance Exact Ledger & Goal-Seek',
    summary: 'Audit decimal line items, fractional allocations, tax reversal and a linear breakeven. Currency amounts use dimensionless numbers in one assumed currency; no exchange-rate model is included.',
    rows: [
      ['Decimal line items', '=0.1', '=0.2', '=B2+C2', '=D2*100', '0.30 currency units is exactly 30 minor units.', '0.3'],
      ['Thirds allocation', '=100', '=3', '=B3/C3', '=D3*C3', '100/3 stays exact. Rounding and distributing actual minor units is a separate policy.', '100/3'],
      ['Exact reconciliation', '=D3', '=3', '=B4*C4', '=D4-100', 'Recombining three rational shares leaves zero residual.', '100.0'],
      ['Tax at 7.5%', '=19.99', '=7.5%', '=B5*C5', '=B5+D5', 'Exact pre-rounding tax is 1.49925; currency rounding is not automatic.', '1.49925'],
      ['Reverse 15% tax', '=230', '=15%', '=solve x+C6*x=B6', '=D6*(1+C6)', 'Recover a tax-exclusive base of 200 exactly.', 'x = 200'],
      ['Breakeven units', '=450', '=15', '=solve C7*x=B7', '=D7*C7-B7', 'Fixed cost divided by contribution per unit is a linear solve.', 'x = 30'],
      ['Eight-period compounding', '=1000', '=1/10', '=B8*(1+C8)^8', '=D8-B8', 'Exact rational compounding; compare the optional Float64 view.', '2143.58881'],
      ['Large ledger increment', '=9007199254740993', '=1', '=B9+C9', '=D9-B9', 'Beyond the safe integer limit of default JavaScript Numbers.', '9007199254740994.0'],
      ['Linear discount reversal', '=240', '=12.5%', '=solve x-C10*x=B10', '=D10*(1-C10)', 'A repeating exact answer is retained as 1920/7.', 'x = 1920/7'],
      ['Identity reconciliation', '=1/3', '=2/3', '=solve x+B11+C11=x+1', '', 'Every x satisfies a fully reconciled ledger identity.', 'all x'],
      ['Contradiction guard', '=0.01', '=0.02', '=solve x+B12=x+C12', '', 'The discrepancy cannot be corrected by the same unknown on both sides.', 'no solution'],
      ['Variable-rate boundary', 'unknown rate', 'eight periods', '=solve (1+x)^8=2', '', 'Expected rejection: an unknown compounding rate is nonlinear.', 'Only linear equations are supported.'],
      ['Variable denominator', 'unknown quantity', 'reciprocal cost', '=solve 100/x=20', '', 'Expected rejection: variables in denominators are unsupported.', 'Variables in denominators are unsupported.']
    ]
  },
  mechanics: {
    title: 'Workbook 7 · Physics Energy, Momentum & Dimensions',
    summary: 'Use rational scalar models to check kinetic energy, momentum, spring energy, pressure and exact unit cancellation. Measurement uncertainty and nonlinear equation solving remain outside this workbook.',
    rows: [
      ['Kinetic energy', '=1.5 kg', '=3 m/s', '=(1/2)*B2*C2^2', '=convert D2 to j', 'The exact 6.75 J result has dimension m²·s^-2·kg.', '6.75 m^2 * s^-2 * kg'],
      ['Momentum', '=B2', '=C2', '=B3*C3', '=D3/B3', 'Momentum / mass recovers the original velocity.', '4.5 m * s^-1 * kg'],
      ['Spring energy', '=80 n/m', '=0.15 m', '=(1/2)*B4*C4^2', '=convert D4 to j', 'A known displacement can be squared; an unknown nonlinear displacement cannot be solved.', '0.9 m^2 * s^-2 * kg'],
      ['Constant acceleration', '=9.8 m/s^2', '=2 s', '=(1/2)*B5*C5^2', '=convert D5 to cm', 'Assumed exact acceleration; not an uncertainty propagation model.', '19.6 m'],
      ['Contact pressure', '=25 n', '=0.005 m^2', '=B6/C6', '=convert D6 to kpa', 'Force / area yields 5 kPa exactly.', '5000 m^-1 * s^-2 * kg'],
      ['Volume conversion', '=1 l', 'cubic centimetres', '=convert B7 to cm^3', '=convert D7 to l', 'A converted volume retains its scale on a round trip.', '1000 cm^3'],
      ['Dimensionless ratio', '=2 m', '=50 cm', '=B8/C8', '=D8-4', 'Equal dimensions cancel even when display units differ.', '4.0'],
      ['Energy conservation', '=D2', '=D4', '=B9+C9', '=convert D9 to j', 'Both energies share compatible dimensions.', '7.65 m^2 * s^-2 * kg'],
      ['Rational wave period', '=97 hz', '=1', '=C10/B10', '=D10*B10', 'One period is an exact 1/97 second.', '(1/97) s'],
      ['Energy + time guard', '=1 j', '=1 s', '=B11+C11', '', 'Expected rejection: compatible units are required for addition.', 'Addition requires compatible units.'],
      ['Speed from kinetic energy', '=D2', '=B2', '=sqrt(2*B12/C12)', '=convert D12 to m/s', 'This square root is exact: 2E/m = 9 m²/s², so speed is 3 m/s.', '3 m * s^-1'],
      ['Unit-bearing solve', '=2 m', '=4 m', '=solve x*B13=C13', '', 'Expected rejection: normalize dimensions before an affine scalar solve.', 'Equations with units are unsupported.'],
      ['Exponent budget', '=1 m', '=10', '=(B14^C14)*B14', '', 'Expected rejection: SI exponents are bounded to ±10.', 'Unit exponent budget exceeded.']
    ]
  },
  risk: {
    title: 'Workbook 8 · Financial Risk & Stress Scenarios',
    summary: 'A discrete one-period loss distribution, credit-loss scenarios, hedge sizing and two-asset portfolio variance. Amounts use one assumed currency. Inputs and tail selection are illustrative; this is not a calibrated regulatory model.',
    sources: [['Credit expected loss · BIS', 'https://www.bis.org/basel_framework/chapter/CRE/35.htm?inforce=20230101&published=20200327&tldate=19970826'], ['VaR and expected shortfall · BIS', 'https://www.bis.org/committees/bcbs/basel-framework/standard/mar/10/inforce/2022-01-01/published/2019-12-15']],
    rows: [
      ['Normal-market loss', '=-500', '=90%', '=B2*C2', '=C2', 'Negative loss means a gain. Outcomes are ordered from smallest to largest loss; E is cumulative probability.', '-450.0'],
      ['Moderate-loss scenario', '=1500', '=6%', '=B3*C3', '=E2+C3', 'A 1500 loss has 6% probability; cumulative probability reaches 96%.', '90.0'],
      ['Severe-loss scenario', '=5000', '=3%', '=B4*C4', '=E3+C4', 'A 5000 loss has 3% probability; cumulative probability reaches 99%.', '150.0'],
      ['Extreme-loss scenario', '=15000', '=1%', '=B5*C5', '=E4+C5', 'A 15000 loss has 1% probability; cumulative probability reaches 100%.', '150.0'],
      ['Probability reconciliation', '=SUM(C2:C5)', '=1', '=B6-C6', '=B6', 'The distribution is valid when this residual is zero. Recheck it after editing probabilities.', '0.0'],
      ['Expected net loss', '=SUM(D2:D5)', '=1', '=B7*C7', '=-D7', 'The probability-weighted net loss is -60, meaning a 60 expected gain in this toy model.', '-60.0'],
      ['95% VaR: selected cutoff', '=95%', '=E3', '=B3', '=C8-B8', 'For these fixed ordered inputs, 1500 is the first loss with cumulative probability at least 95%. The cutoff is selected explicitly, not automatically sorted; reselect it if probabilities change.', '1500.0'],
      ['95% expected shortfall', '=B3*1%+B4*C4+B5*C5', '=5%', '=B9/C9', '=D9*C9', 'Average loss in the worst 5%: 1% mass at 1500, 3% at 5000 and 1% at 15000. Adjust this explicit tail allocation if probabilities change.', '6300.0'],
      ['Default-weighted exposure', '=100000', '=2%', '=B10*C10', '=D10/B10', 'One-period exposure at default × probability of default. This is not yet loss: apply loss given default in the next row.', '2000.0'],
      ['Expected credit loss', '=45%', '=D10', '=B11*C11', '=D11/B10', 'Simplified undiscounted one-period loss = EAD × PD × LGD: 100000 × 2% × 45% = 900.', '900.0'],
      ['Stressed default rate', '=4%', '=B11', '=B10*B12*C12', '=D12-D11', 'Doubling PD from 2% to 4% raises expected loss to 1800, with other inputs fixed.', '1800.0'],
      ['Second facility loss', '=250000', '=1.5%', '=B13*C13*35%', '=D13/B13', 'A second facility has 35% LGD. Exact pre-rounding expected loss is 1312.5.', '1312.5'],
      ['Combined credit loss', '=D11', '=D13', '=B14+C14', '=D14/(B10+B13)', 'Sum the expected losses; E shows expected loss as a fraction of total exposure. Dependence assumptions affect tail risk, not this sum of means.', '2212.5'],
      ['Hedge fraction for loss cap', '=15000', '=5000', '=solve B15*(1-x)=C15', '=B15*(1-D15)', 'A toy perfectly proportional hedge requires x = 2/3 to reduce the extreme loss to 5000. Basis risk and costs are excluded.', 'x = 2/3'],
      ['Asset A variance contribution', '=3/5', '=(1/10)^2', '=B16^2*C16', '=D16*10000', 'Weight 60%, volatility 10%; variance contribution is w² × sigma².', '0.0036'],
      ['Asset B variance contribution', '=2/5', '=(1/5)^2', '=B17^2*C17', '=D17*10000', 'Weight 40%, volatility 20%; variance contribution is w² × sigma².', '0.0064'],
      ['Covariance contribution', '=1/2', '=(1/10)*(1/5)', '=2*B16*B17*B18*C18', '=D18/2', 'Correlation 0.5 gives the cross term 2 × wA × wB × rho × sigmaA × sigmaB.', '0.0048'],
      ['Portfolio variance', '=SUM(D16:D18)', '=100000^2', '=B19*C19', '=B19', 'Return variance is 0.0148; a 100000 portfolio has loss variance 148000000 currency units squared.', '148000000.0'],
      ['Volatility: irrational limit', '=B19', 'square root of variance', '=sqrt(B20)', '', 'Expected limit: sqrt(0.0148) is irrational. Reporting volatility requires an explicitly approximate numeric mode.', 'Square root is irrational; exact rational results only.'],
      ['Recovery-driven stress', '=B10', '=20%', '=B21*C10*(1-C21)', '=D21-D11', 'A 20% recovery assumption means 80% LGD; expected loss rises to 1600.', '1600.0'],
      ['Reserve coverage fraction', '=1500', '=D14', '=B22/C22', '=D22*C22', 'Reserve / combined expected loss remains exactly 40/59 before reporting-rounding rules.', '40/59'],
      ['Zero-loss ratio guard', '=1500', '=0', '=B23/C23', '', 'Expected limit: reserve coverage has no defined ratio when the denominator is zero.', 'undefined']
    ]
  },
  excel: {
    title: 'Workbook 10 · Exact Numbers & Numeric Boundaries',
    summary: 'Explore long integers, tiny increments, repeating fractions, very large and small exact values, SI unit tracking and inline linear solving.',
    rows: [
      ['30-digit integer increment', '=123456789012345678901234567890', '=1', '=B2+C2', '=D2-B2', 'AliceMath preserves all 30 digits and the +1.', '123456789012345678901234567891.0'],
      ['Tiny increment beside one', '=1', '=0.00000000000000000001', '=B3+C3', '=D3-B3', 'Exact arithmetic retains the 10^-20 increment. Normal binary floating point cannot distinguish this sum from 1.', '1.00000000000000000001'],
      ['Repeating prime stays rational', '=1/97', '=96/97', '=B4', '=B4+C4', 'Inspect AliceMath’s exact numerator and denominator.', '1/97'],
      ['Exact fractional linear solve', '=1/97', '=1/7', '=solve B5*x+C5=1/3', '=B5*D5+C5', 'The exact answer is 388/21.', 'x = 388/21'],
      ['Very large integer', '=2', '=10', '=(((B6^C6)^C6)^C6)^4', '=D6/D6', 'E cancels it exactly to 1.', (2n ** 4000n).toString() + '.0', 'Exact 2^4000: a 1205-digit integer. E = 1 exactly.'],
      ['Very small positive value', '=2', '=10', '=1/(((B7^C7)^C7)^C7)^4', '=D7*D6', 'E multiplies it by 2^4000 to recover 1; use Strict Fraction for a compact numerator/denominator view.', '0.' + (5n ** 4000n).toString().padStart(4000, '0'), 'Exact positive 1/2^4000; 4000 decimal places. E = 1 exactly.'],
      ['Carry SI dimensions through energy', '=2 kg', '=3 m/s', '=(1/2)*B8*C8^2', '=convert D8 to j', 'AliceMath carries m²·s^-2·kg through the expression automatically.', '9 m^2 * s^-2 * kg'],
      ['Reject mixed dimensions', '=5 m', '=2 s', '=B9+C9', '', 'Numeric cells containing 5 and 2 do not retain metre/second dimensions.', 'Addition requires compatible units.'],
      ['Classify a symbolic identity', '=1/3', '=2/3', '=solve x+B10+C10=x+1', '', 'The affine engine classifies this equation as true for every x.', 'all x'],
      ['Classify a contradiction', '=0.01', '=0.02', '=solve x+B11=x+C11', '', 'Moving both affine expressions to one side exposes a nonzero constant with no x term.', 'no solution'],
      ['Exact large-integer square root', '=' + (12345678901234567890n ** 2n).toString(), 'perfect square', '=sqrt(B12)', '=D12^2-B12', 'The exact 20-digit root survives because the integer square is retained.', '12345678901234567890.0'],
      ['Fractional range arithmetic', '=1/7', '=2/7', '=SUM(B13:C13)', '=D13*7', 'Spreadsheet references preserve exact rational values rather than formatted approximations.', '3/7']
    ]
  },
  rocket: {
    title: 'Workbook 11 · Rocket Ascent & Exact Time Steps',
    summary: 'A toy vertical rocket with constant thrust, propellant flow and gravity. Four state variables are carried through three half-second explicit Euler steps. Exact arithmetic removes rounding in the discrete model; it does not remove integration error. No drag, staging, Earth curvature or gravity turn is modeled.',
    rows: [
      ['Initial wet mass', '=1000 kg', 'toy launch vehicle', '=B2', '', 'Treat the supplied mass as exact for this educational model.', '1000 kg'],
      ['Constant thrust', '=20000 n', 'vertical thrust', '=B3', '', 'Thrust remains constant throughout these three steps.', '20000 m * s^-2 * kg'],
      ['Propellant mass flow', '=2 kg/s', 'constant burn', '=B4', '', 'Mass decreases by flow × time; no staging is included.', '2 s^-1 * kg'],
      ['Constant gravity', '=10 m/s^2', 'assumed gravity', '=B5', '', 'A deliberately rounded physical assumption, represented exactly as an input.', '10 m * s^-2'],
      ['Euler time step', '=0.5 s', 'half-second step', '=B6', '', 'Euler uses acceleration and velocity at the start of each step.', '0.5 s'],
      ['Initial upward velocity', '=0 m/s', 'launch from rest', '=B7', '', 'Vertical speed starts at zero.', '0 m * s^-1'],
      ['Initial altitude', '=0 m', 'launch height', '=B8', '', 'Altitude starts at zero relative to the launch point.', '0 m'],
      ['Step 1 acceleration', '=B3', '=D2', '=B9/C9-B5', '=D9+B5', 'a₀ = thrust / initial mass − gravity.', '10 m * s^-2'],
      ['Mass at 0.5 seconds', '=D2', '=B4*B6', '=B10-C10', '=D2-D10', 'm₁ = m₀ − flow × dt.', '999 kg'],
      ['Velocity at 0.5 seconds', '=D7', '=D9*B6', '=B11+C11', '=convert D11 to m/s', 'v₁ = v₀ + a₀ × dt.', '5 m * s^-1'],
      ['Altitude at 0.5 seconds', '=D8', '=D7*B6', '=B12+C12', '=convert D12 to m', 'Explicit Euler uses the old velocity, so the first altitude increment is zero. This is integration error, not a calculation bug.', '0 m'],
      ['Step 2 acceleration', '=B3', '=D10', '=B13/C13-B5', '=D13+B5', 'Lower mass increases acceleration; the answer is a repeating rational.', '(10010/999) m * s^-2'],
      ['Mass at 1 second', '=D10', '=B4*B6', '=B14-C14', '=D2-D14', 'm₂ = m₁ − flow × dt.', '998 kg'],
      ['Velocity at 1 second', '=D11', '=D13*B6', '=B15+C15', '=convert D15 to m/s', 'v₂ remains exactly 10000/999 m/s.', '(10000/999) m * s^-1'],
      ['Altitude at 1 second', '=D12', '=D11*B6', '=B16+C16', '=convert D16 to m', 'h₂ = h₁ + v₁ × dt.', '2.5 m'],
      ['Step 3 acceleration', '=B3', '=D14', '=B17/C17-B5', '=D17+B5', 'Use the start-of-step mass of 998 kg.', '(5010/499) m * s^-2'],
      ['Mass at 1.5 seconds', '=D14', '=B4*B6', '=B18-C18', '=D2-D18', 'Three steps consume 3 kg of propellant.', '997 kg'],
      ['Velocity at 1.5 seconds', '=D15', '=D17*B6', '=B19+C19', '=convert D19 to m/s', 'Every step retains the exact rational velocity.', '(7492495/498501) m * s^-1'],
      ['Altitude at 1.5 seconds', '=D16', '=D15*B6', '=B20+C20', '=convert D20 to m', 'Discrete Euler altitude, not an exact continuous-flight solution.', '(14995/1998) m'],
      ['Constant-mass reference height', '=D9', '=3*B6', '=(1/2)*B21*C21^2', '=D21-D20', 'At constant initial mass, analytic h = ½at² gives 11.25 m. E compares two different models and includes Euler discretization effects.', '11.25 m'],
      ['Solve initial thrust target', '=B2/(1 kg)', '=15', '=solve x/B22-B5/(1 m/s^2)=C22', '=D22*1 n', 'Normalize SI values, solve thrust for an initial net acceleration of 15 m/s², then restore newtons.', 'x = 25000'],
      ['Coast apex after engine cutoff', '=D20', '=D19', '=B23+C23^2/(2*B5)', '=convert D23 to m', 'Cut thrust at the final discrete state; constant gravity and no drag give an exact rational additional rise.', '(18687568715015/994012988004) m'],
      ['Nonlinear time solve boundary', 'unknown time squared', 'analytic ascent', '=solve 5*x*x=100', '', 'A quadratic time solve exceeds the affine solver. This intentional limit has a yellow calculation comment.', 'Only linear equations are supported.'],
      ['Atmospheric density boundary', 'exponential atmosphere', 'Inspect the exact result and its rational representation.', '=exp(-1/10)', '', 'Exponential density and trigonometric gravity turns require a broader approximate numerical engine.', 'Unsupported expression'],
      ['Remaining propellant check', '=D2-D18', '=B4*(3*B6)', '=B26-C26', '=D18/D2', 'Mass loss reconciles exactly to zero. The model does not permit extrapolation past dry mass; no dry-mass input is supplied.', '0 kg']
    ]
  },
  exactStress: {
    title: 'Workbook 12 · Deep Decimals & Cancellation Audit',
    summary: 'Explore a 100-place terminating decimal, amplified cancellation, an unstable affine recurrence, prime-ratio reconciliation and SI energy. Exactness applies to supplied rational inputs within the 4096-bit budget. The Float Drift view evaluates arithmetic within each resolved cell; references start from exact upstream values converted to Float64, so a nested formula is included for cumulative rounding.',
    rows: [
      ['Terminating decimal seed', '=(1/5)^10', '=5', '=B2^C2', '=D2*5^10*5^10*5^10*5^10*5^10', 'The seed is 1/5^10. Raising it to five gives 1/5^50; E multiplies it back to one.', '0.00000000000000000000000000000000001125899906842624'],
      ['100-place exact expansion', '=D2', '=(1/2)^5', '=B3*B3*C3', '=D3/D2/D2/C3', '1/(5^100 × 2^5) terminates at decimal place 100. Inspect D3 or enable Wrap Text to see every digit. Float64 can represent a nearby nonzero value, but cannot retain all exact digits.', '0.0000000000000000000000000000000000000000000000000000000000000000000000039614081257132168796771975168', 'Exact 1/(5^100 × 2^5), terminating at decimal place 100.'],
      ['Amplified cancellation', '=1/3', '=(10^8)^2', '=(B4*C4-3333333333333333)*3', '=solve D4*x=1', 'The exact result is one. Toggle Float Drift: rounding during multiplication and subtraction can erase the residual.', '1.0'],
      ['Affine recurrence: step 1', '=1/3', '=10000', '=C5*B5-3333', '=D5-B5', 'x → 10000x − 3333 fixes 1/3 exactly but amplifies perturbations by 10000 per step.', '1/3'],
      ['Affine recurrence: step 2', '=D5', '=10000', '=C6*B6-3333', '=D6-1/3', 'Chained cells retain exact fractions. This Float Drift comparison starts from the exact referenced value, not the previous cell’s rounded simulation.', '1/3'],
      ['Affine recurrence: step 3', '=D6', '=10000', '=C7*B7-3333', '=D7-1/3', 'The exact fixed point remains 1/3.', '1/3'],
      ['Affine recurrence: step 4', '=D7', '=10000', '=C8*B8-3333', '=D8-1/3', 'Four chained exact steps leave a zero residual. This is an unstable affine recurrence, not bounded chaos.', '1/3'],
      ['Four steps in one expression', '=1/3', '=10000', '=10000*(10000*(10000*(10000*B9-3333)-3333)-3333)-3333', '=D9-1/3', 'All four operations are nested in one cell so Float Drift propagates binary rounding across the entire recurrence.', '1/3'],
      ['Prime harmonic remainder', '=1/17+1/19', '=1/23', '=solve x+B10+C10=1', '=B10+C10+D10', 'The exact remaining share is 6278/7429. E reconciles all shares to exactly one; monetary rounding policies are separate.', 'x = 6278/7429'],
      ['Prime gear-train identity', '=17/97', '=(97/53)*(53/89)*(89/17)', '=B11*C11', '=D11-1', 'Prime factors cancel exactly. A Float64 chain may or may not leave a residue, depending on rounding and evaluation order.', '1.0'],
      ['Fractional power to energy', '=(3/7) kw', '=14 min', '=B12*C12', '=convert D12 to kj', 'Exact energy is 360000 joules, or 360 kJ, with SI exponents [2, −2, 1].', '360000 m^2 * s^-2 * kg'],
      ['Force plus power guard', '=1 n', '=1 w', '=B13+C13', '', 'Force and power have different SI dimensions. The yellow comment explains the incompatible addition.', 'Addition requires compatible units.']
    ]
  },
  regression: {
    title: 'Workbook 13 · Linear Regression & Logistic Odds',
    summary: 'Fit y = intercept + slope × x by ordinary least squares using four exact rational observations. Then calculate logistic-model probabilities from supplied baseline odds and an odds ratio. The logistic section does not estimate coefficients: logit-space fitting, standard errors and iterative maximum likelihood require functions outside this engine. All examples use dimensionless educational inputs.',
    rows: [
      ['Observation 1', '=1', '=2', '=B2*C2', '=B2^2', 'B is predictor x, C is observed response y, D is xy and E is x².', '2.0'],
      ['Observation 2', '=2', '=3', '=B3*C3', '=B3^2', 'Edit any B2:C5 observation to refit the linear model.', '6.0'],
      ['Observation 3', '=3', '=5', '=B4*C4', '=B4^2', 'Rational arithmetic preserves intermediate products.', '15.0'],
      ['Observation 4', '=4', '=4', '=B5*C5', '=B5^2', 'The response need not lie exactly on a straight line.', '16.0'],
      ['Linear sufficient statistics', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', 'Σx = 10, Σy = 14, Σxy = 39, Σx² = 30. The sample count is fixed at four; update it in row 7 if changing the sample size.', '39.0'],
      ['OLS fitted slope', '=4', '=B7*E6-B6^2', '=(B7*D6-B6*C6)/C7', '=D7*C7-(B7*D6-B6*C6)', 'Slope = (nΣxy − ΣxΣy)/(nΣx² − (Σx)²). Identical predictors make the denominator zero and the slope undefined.', '0.8'],
      ['OLS fitted intercept', '=C6/B7', '=B6/B7', '=B8-D7*C8', '=D8+D7*C8', 'Intercept = mean(y) − slope × mean(x). E checks the fit passes through the sample means.', '1.5'],
      ['Residual 1', '=C2', '=D8+D7*B2', '=B9-C9', '=D9^2', 'Residual is observed minus fitted; E is squared residual.', '-0.3'],
      ['Residual 2', '=C3', '=D8+D7*B3', '=B10-C10', '=D10^2', 'These four residuals sum to zero for this intercept model.', '-0.1'],
      ['Residual 3', '=C4', '=D8+D7*B4', '=B11-C11', '=D11^2', 'The largest positive residual is 1.1.', '1.1'],
      ['Residual 4', '=C5', '=D8+D7*B5', '=B12-C12', '=D12^2', 'The final residual is −0.7.', '-0.7'],
      ['Residual sum of squares', '=SUM(E9:E12)', '=SUM(D9:D12)', '=B13', '=C13', 'SSE = 1.8; E checks the residual sum is zero.', '1.8'],
      ['Total sum of squares', '=B8', '=B7', '=(C2-B14)^2+(C3-B14)^2+(C4-B14)^2+(C5-B14)^2', '=D14/C14', 'SST = Σ(y − mean(y))² = 5. Constant responses make R² undefined.', '5.0'],
      ['Coefficient of determination', '=D13', '=D14', '=1-B15/C15', '=D15*C15+B15', 'R² = 1 − SSE/SST = 0.64. This describes this sample fit, not prediction accuracy on new data.', '0.64'],
      ['Predict a new response', '=5', '=D7', '=D8+C16*B16', '=solve D8+C16*x=5.5', 'At predictor 5, fitted y is 5.5; E solves the inverse linear question. Extrapolation needs domain judgment.', '5.5'],
      ['Logistic baseline probability', '=1/5', 'supplied model input', '=B17/(1-B17)', '=D17/(1+D17)', 'D converts baseline probability p₀ = 0.2 to baseline odds 1/4. Valid probabilities lie strictly between zero and one.', '0.25'],
      ['Supplied odds multiplier', '=3/2', 'per predictor step', '=B18', '', 'The assumed odds ratio is 1.5 per unit. This is supplied, not fitted; a logistic coefficient would be ln(1.5).', '1.5'],
      ['Logistic probability at x = 0', '=0', '=D17*D18^B19', '=C19/(1+C19)', '=1-D19', 'p(x) = O₀ × OR^x / (1 + O₀ × OR^x). Integer predictor steps permit exact rational calculations.', '0.2'],
      ['Logistic probability at x = 1', '=1', '=D17*D18^B20', '=C20/(1+C20)', '=D20/(1-D20)', 'At one step, odds are 3/8 and probability is 3/11.', '3/11'],
      ['Logistic probability at x = 2', '=2', '=D17*D18^B21', '=C21/(1+C21)', '=D21/(1-D21)', 'At two steps, odds are 9/16 and probability is 9/25.', '0.36'],
      ['Logistic probability at x = −1', '=-1', '=D17*D18^B22', '=C22/(1+C22)', '=D22/(1-D22)', 'A negative integer step divides baseline odds by the odds ratio, giving p = 1/7.', '1/7'],
      ['Logistic probability at x = 3', '=3', '=D17*D18^B23', '=C23/(1+C23)', '=D23/(1-D23)', 'At three steps, odds are 27/32 and probability is 27/59. Exponents must stay within −10…10.', '27/59'],
      ['Logit coefficient boundary', '=D18', 'requires natural log', '=log(B24)', '', 'Estimating or converting logit coefficients requires logarithms. Exact rational logarithms are outside this engine.', 'Unsupported expression'],
      ['Sigmoid expression boundary', '=1', 'requires exponential', '=1/(1+exp(-B25))', '', 'The usual sigmoid and iterative logistic fitting need an approximate numerical engine. The odds rows above avoid exp only because rational odds and integer steps were supplied.', 'Unsupported expression'],
      ['Linear residual reconciliation', '=SUM(D9:D12)', '=0', '=B26-C26', '=D26^2', 'Zero verifies the residual sum for the fitted intercept model. No hypothesis tests or confidence intervals are provided.', '0.0']
    ]
  },
  precision: {
    title: 'Workbook 9 · Precision & Guardrail Stress Lab',
    summary: 'Inspect large integers, repeating primes, decimal termination, parser precedence and bounded failure cases. Exactness means exact arithmetic on the supplied inputs, within the engine’s budgets.',
    rows: [
      ['Safe-integer boundary', '=9007199254740993', '=1', '=B2+C2', '=D2-B2', 'Default Number cannot preserve every integer above 2^53−1.', '9007199254740994.0'],
      ['Repeating prime', '=1/97', '=96/97', '=B3+C3', '=D3-1', 'Non-terminating decimals remain fractions until exact cancellation.', '1.0'],
      ['Terminating denominator', '=1/40', '=7/125', '=B4+C4', '', 'Denominators containing only factors 2 and 5 produce exact decimals.', '0.081'],
      ['Nested integer power', '=2', '=10', '=((B5^C5)^C5)', '=D5/D5', '2^100 is represented as a BigInt rational, not a Float64 approximation.', '1267650600228229401496703205376.0'],
      ['Expression precedence', '=2^3^2', 'right-associative power', '=B6', '=(-2)^2', '2^(3^2) = 512; parenthesized negative base squares to 4.', '512.0'],
      ['Fractional length', 'parenthesized magnitude', 'implicit multiplication', '=(1/3) m', '=D7*3', 'Write (1/3) m for one-third metre.', '(1/3) m'],
      ['Reciprocal length', 'division binds below units', 'implicit multiplication', '=1/3 m', '=D8*3 m', '1/3 m means 1/(3 m), with dimension m^-1.', '(1/3) m^-1'],
      ['Allowed linear power', 'x raised to one', 'affine solve', '=solve x^1=4', '=D9+1', 'A first power remains linear.', 'x = 4'],
      ['Zero-power identity', 'x raised to zero', 'engine power convention', '=solve x^0=1', '', 'Under this engine’s zero-power convention every x satisfies the identity.', 'all x'],
      ['Variable denominator guard', '1/x', 'rational function', '=solve 1/x=2', '', 'Expected rejection of a variable denominator.', 'Variables in denominators are unsupported.'],
      ['Fractional exponent guard', 'square root through power', 'irrational result', '=2^(1/2)', '', 'Expected rejection: only integer exponents from −10 to 10.', 'Use an integer exponent from -10 to 10.'],
      ['Exponent range guard', 'power eleven', 'resource boundary', '=2^11', '', 'Expected rejection even though the numerical result is small.', 'Use an integer exponent from -10 to 10.'],
      ['Division by zero', '=1', '=0', '=B14/C14', '', 'The engine labels division by zero undefined.', 'undefined'],
      ['Nonlinear product guard', 'x*x', 'quadratic equation', '=solve x*x=4', '', 'Expected rejection of a quadratic equation.', 'Only linear equations are supported.'],
      ['Mixed-dimension guard', '=3 m', '=1 s', '=B16+C16', '', 'Expected rejection of incompatible dimensions.', 'Addition requires compatible units.']
    ]
  }
};
