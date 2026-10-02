/*
  LIFT-MASLD calculator

  IMPORTANT:
  The final model constants have NOT yet been inserted.

  Next step:
  Export the exact SCORE-BAR model constants from R and replace
  MODEL below with the validated values.
*/


const MODEL = {

  /*
    These placeholders will eventually contain things such as:

    medians: {
      lsm: ...,
      bilirubin: ...,
      alp: ...,
      platelets: ...
    },

    centering: {...},

    scaling: {...},

    betaVisit2: {...},

    betaVisit3: {...},

    calibrationVisit2: {
      intercept: ...,
      slope: ...
    },

    calibrationVisit3: {
      intercept: ...,
      slope: ...
    },

    percentileReference: [...]
  */

  ready: false
};


/* ---------- Helpers ---------- */


function getOptionalNumber(id) {

  const raw = document.getElementById(id).value.trim();

  if (raw === "") {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
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


function ordinalSuffix(n) {

  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }

  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}


/* ---------- Read clinical inputs ---------- */


function readInputs() {

  const lsm = getOptionalNumber("lsm");
  const bilirubin = getOptionalNumber("bilirubin");
  const alp = getOptionalNumber("alp");
  const platelets = getOptionalNumber("platelets");
  const ast = getOptionalNumber("ast");
  const astULN = getOptionalNumber("ast-uln");


  /*
    Platelet missingness indicator.

    If platelets are unavailable:
      plateletMissing = 1

    The validated model will then substitute the fixed
    HALO training median for the numerical platelet value.
  */

  const plateletMissing =
    platelets === null ? 1 : 0;


  /*
    APRI availability.

    APRI = [(AST / AST_ULN) / platelets] * 100

    The final fitted model does NOT use the APRI magnitude,
    but it does contain an APRI-missing indicator.

    APRI is therefore considered available only when:
      AST is available
      AST ULN is available
      platelet count is available
  */

  const apriAvailable =
    ast !== null &&
    astULN !== null &&
    astULN > 0 &&
    platelets !== null &&
    platelets > 0;

  const apriMissing =
    apriAvailable ? 0 : 1;


  /*
    We calculate APRI anyway for auditing/debugging,
    even though its numerical value currently has
    coefficient zero in the final model.
  */

  const apri = apriAvailable
    ? ((ast / astULN) / platelets) * 100
    : null;


  return {
    lsm,
    bilirubin,
    alp,
    platelets,
    ast,
    astULN,

    plateletMissing,
    apriMissing,
    apri
  };
}


/* ---------- Display result ---------- */


function displayPercentile(percentile) {

  percentile =
    Math.max(0, Math.min(100, percentile));

  const rounded =
    Math.round(percentile);

  const numberElement =
    document.getElementById("percentile-value");

  const resultCard =
    document.getElementById("result-card");

  const fill =
    document.getElementById("percentile-fill");

  const marker =
    document.getElementById("percentile-marker");

  const interpretation =
    document.getElementById("interpretation");


  numberElement.textContent = rounded;


  /*
    Set correct ordinal suffix.
  */

  const suffix =
    ordinalSuffix(rounded);

  const sup =
    document.querySelector(".result-number sup");

  sup.textContent = suffix;


  /*
    Percentile bar.
  */

  fill.style.width =
    `${percentile}%`;

  marker.style.left =
    `${percentile}%`;


  interpretation.textContent =
    `The predicted hepatic disease severity is higher than approximately ` +
    `${rounded}% of participants in the HALO-MASLD reference cohort.`;


  resultCard.classList.remove("hidden");

  resultCard.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* ---------- Prediction ---------- */


function calculateLIFT() {

  clearError();

  const values =
    readInputs();


  /*
    Basic validity checks.
  */

  if (
    values.astULN !== null &&
    values.astULN <= 0
  ) {

    showError(
      "AST upper limit of normal must be greater than zero."
    );

    return;
  }


  /*
    Do not generate a fake prediction until the exact
    validated model constants have been exported from R.
  */

  if (!MODEL.ready) {

    showError(
      "The calculator interface is working, but the validated " +
      "LIFT-MASLD model constants have not yet been loaded."
    );

    console.log(
      "Clinical inputs:",
      values
    );

    return;
  }


  /*
    FINAL IMPLEMENTATION WILL GO HERE:

      1. Replace missing values with fixed training medians.

      2. Apply:
           log1p(LSM)
           log1p(total bilirubin)

      3. Apply the exact training-derived centering/scaling.

      4. Add:
           platelet_missing
           APRI_missing

      5. Calculate X beta.

      6. Apply the training-derived calibration.

      7. Convert the predicted hepatic phenotype
         to its HALO reference percentile.

  */


  // Example only after MODEL is populated:
  //
  // const percentile =
  //   predictPercentile(values);
  //
  // displayPercentile(percentile);
}


/* ---------- Event ---------- */


document
  .getElementById("calculate")
  .addEventListener(
    "click",
    calculateLIFT
  );
