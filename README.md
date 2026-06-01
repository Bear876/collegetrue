## CollegeTrue

CollegeTrue is a web app that gives US high‑school students a financial reality check on their college options by comparing loan burden as a percent of their first paycheck.

## What It Does

- Lets you enter up to three US colleges, an intended major, and a family income band.
- Pulls cost and earnings data from the College Scorecard API, with local fallback estimates when the API is unavailable.
- Estimates 4‑year net cost, 10‑year loan payments, and monthly payment as a percent of your first paycheck.
- Visualises the financial impact with scorecards, burden bars, and a simple life timeline.

## Live Demo

- App: https://bear876.github.io/collegetrue/

## Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Bear876/collegetrue.git
   cd collegetrue
   ```
2. Open `index.html` directly in your browser **or** serve it with a simple HTTP server:
   ```bash
   python -m http.server 5500
   ```
   Then visit `http://localhost:5500/index.html`.

## Built With

- HTML
- CSS
- JavaScript
- U.S. Department of Education College Scorecard API
- GitHub Pages

## Basic Assumptions for Modeling:

1. Salaries are agnostic of which college you attend; expected earnings depend on your intended major or field, not on the specific institution.
2. Calculations are based on annual net price (cost after typical grants and aid) and assume a 4‑year graduation timeline, so total cost is approximated as 4 times one year of net price.
3. The model assumes you finance the full net cost with student loans and repay them on a standard 10‑year plan, using a simple monthly payment approximation.
4. “Percent of paycheck” is computed by comparing the estimated monthly loan payment to a rough take‑home monthly income derived from your major’s expected starting salary.
5. Life timeline projections assume you start full‑time work around age 23, keep a constant real (inflation‑adjusted) salary in early career, and save what is left after loan payments and a fixed monthly living‑cost estimate.
6. When live College Scorecard data is unavailable or rate‑limited, the tool falls back to public benchmarks and generic estimates so that comparisons remain possible, with all figures treated as illustrative rather than exact.
