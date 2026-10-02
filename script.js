let MODEL = null;


/* ============================================================
   Load validated LIFT-MASLD model
   ============================================================ */

fetch("liftmasld_model.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("Could not load model.");
    }
    return response.json();
  })
  .then(model => {
    MODEL = model;
  })
  .catch(error => {
    console.error(error);
    showError("The LIFT-MASLD model could not be loaded.");
  });


/* ============================================================
   Helpers
   ============================================================ */

function getNumber(id) {
  const x = document.getElementById(id).value.trim();

  if (x === "") {
    return null;
  }

  const z = Number(x);

  return Number.isFinite(z) ? z : null;
}


function showError(message) {
  const box = document.getElementById("form-error");

  box.textContent = message;
  box.classList.remove("hidden");
}


function clearError() {
  const box = document.getElementById("form-error");

  box.textContent = "";
  box.classList.add("hidden");
}


/* ============================================================
   Build the six selected predictor columns
   ============================================================ */

function makePredictors() {

  const lsm = getNumber("lsm");
  const bilirubin = getNumber("bilirubin");
  const alp = getNumber("alp");
  const platelets = getNumber("platelets");
  const ast = getNumber("ast");
  const astULN = getNumber("ast-uln");


  if (astULN !== null && astULN <= 0) {
    throw new Error(
      "AST upper limit of normal must be greater than zero."
    );
  }


  /*
    Names must exactly match the R model.
  */

  const LSM =
    "log1p_liver_stiffness_from_fibroscan_k_pa_x";

  const BILI =
    "log1p_total_bilirubin_x";

  const ALP =
    "alkaline_phosphatase_x";

  const PLT =
    "platelets_x";

  const PLT_MISS =
    "platelets_missing_x";

  const APRI_MISS =
    "log1p_ast_to_platelet_ratio_index_apri_missing_x";


  /*
    Apply the same transformations as the R preprocessing.

    IMPORTANT:
    Median imputation happens on the transformed predictor scale.
  */

  const x = {};


  x[LSM] =
    lsm === null
      ? MODEL.medians[LSM]
      : Math.log1p(lsm);


  x[BILI] =
    bilirubin === null
      ? MODEL.medians[BILI]
      : Math.log1p(bilirubin);


  x[ALP] =
    alp === null
      ? MODEL.medians[ALP]
      : alp;


  x[PLT] =
    platelets === null
      ? MODEL.medians[PLT]
      : platelets;


  /*
    Missingness indicators
  */

  x[PLT_MISS] =
    platelets === null ? 1 : 0;


  /*
    APRI is available only when AST, its ULN,
    and platelets are all available.

    The actual APRI magnitude does not enter the final model;
    only its missingness indicator survived BAR selection.
  */

  const apriAvailable =
    ast !== null &&
    astULN !== null &&
    astULN > 0 &&
    platelets !== null &&
    platelets > 0;


  x[APRI_MISS] =
    apriAvailable ? 0 : 1;


  return x;
}


/* ============================================================
   Predict severity for a particular visit
   ============================================================ */

function predictVisit(x, visitIndex) {

  const names =
    MODEL.selected_predictors;

  const means =
    MODEL.x_means[visitIndex];

  const beta =
    MODEL.beta[visitIndex];


  /*
    Reproduce R:
        X centered by visit-specific training mean
        then divided by training scale
  */

  let z = 0;

  for (const name of names) {

    const standardized =
      (x[name] - means[name]) /
      MODEL.scales[name];

    z += standardized * beta[name];
  }


  /*
    BAR beta is direction-normalized.

    The training-only calibration maps X beta back
    onto the centered learned outcome scale.
  */

  const cal =
    MODEL.calibration[visitIndex];

  const centeredPrediction =
    cal.intercept +
    cal.slope * z;


  /*
    Add back the visit-specific outcome mean.

    This yields the learned phenotype on the
    uncentered alpha scale.
  */

  const rawAlphaPrediction =
    centeredPrediction +
    cal.outcome_offset;


  /*
    Convert to the L2-normalized alpha scale used
    for the clinical severity score.
  */

  const severity =
    rawAlphaPrediction /
    MODEL.alpha_norm;


  return severity;
}


/* ============================================================
   Convert severity value to HALO reference percentile
   ============================================================ */

function percentileFromReference(value, visitIndex) {

  const ref =
    MODEL.reference[visitIndex];

  const q =
    ref.quantiles;

  const p =
    ref.probabilities;


  if (value <= q[0]) {
    return 0;
  }

  if (value >= q[q.length - 1]) {
    return 100;
  }


  for (let i = 1; i < q.length; i++) {

    if (value <= q[i]) {

      const q0 = q[i - 1];
      const q1 = q[i];

      const p0 = p[i - 1];
      const p1 = p[i];


      /*
        Handle tied quantiles.
      */

      if (q1 === q0) {
        return 100 * p1;
      }


      const fraction =
        (value - q0) /
        (q1 - q0);


      return 100 * (
        p0 +
        fraction * (p1 - p0)
      );
    }
  }


  return 100;
}


/* ============================================================
   Formatting
   ============================================================ */

function ordinal(n) {

  const rounded =
    Math.round(n);

  const mod100 =
    rounded % 100;

  let suffix = "th";


  if (!(mod100 >= 11 && mod100 <= 13)) {

    if (rounded % 10 === 1) {
      suffix = "st";
    }

    else if (rounded % 10 === 2) {
      suffix = "nd";
    }

    else if (rounded % 10 === 3) {
      suffix = "rd";
    }
  }


  return `${rounded}${suffix}`;
}


/* ============================================================
   Display results
   ============================================================ */

function showResults(results) {

  const card =
    document.getElementById("result");


  /*
    Current HTML has one interpretation box.
    Put both prospective predictions in it.
  */

  document.getElementById(
    "percentile-value"
  ).textContent =
    ordinal(results[0].percentile);


  document.getElementById(
    "interpretation"
  ).innerHTML = `

    <strong>Visit 2 prediction:</strong>
    ${ordinal(results[0].percentile)} percentile
    <br><br>

    <strong>Visit 3 prediction:</strong>
    ${ordinal(results[1].percentile)} percentile
    <br><br>

    Percentiles are relative to participants in the
    HALO-MASLD reference cohort at the corresponding
    follow-up visit.

  `;


  /*
    Hide the static "percentile" label if desired later.
    For now it remains underneath the primary Visit 2 result.
  */

  card.classList.remove("hidden");

  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* ============================================================
   Main calculation
   ============================================================ */

function calculateLIFT() {

  clearError();


  if (MODEL === null) {

    showError(
      "The model is still loading. Please try again."
    );

    return;
  }


  try {

    const x =
      makePredictors();


    const results =
      MODEL.visits.map(
        (visit, index) => {

          const severity =
            predictVisit(x, index);

          const percentile =
            percentileFromReference(
              severity,
              index
            );


          return {
            visit,
            severity,
            percentile
          };
        }
      );


    console.log(
      "LIFT-MASLD prediction:",
      results
    );


    showResults(results);

  }

  catch (error) {

    console.error(error);

    showError(error.message);
  }
}


/* ============================================================
   Event listener
   ============================================================ */

document
  .getElementById("calculate")
  .addEventListener(
    "click",
    calculateLIFT
  );
