import { WFComponent, WFInvisibleForm } from "@xatom/core";
import { AxiosClient, AxiosClientConfigurator } from "@xatom/axios";
import { postcodeMappings } from "./postcodeMappingsfull"; // Import the mappings (removed .ts extension)

// Define the structure for each step
interface FormStep {
  id: string; // Corresponds to hidden input name
  title: string;
  question: string;
  type:
    | "text"
    | "radio"
    | "select"
    | "checkbox"
    | "lead"
    | "intro"
    | "results"
    | "thankyou"
    | "address"
    | "customEnergyInput";
  options?: { label: string; value: string }[];
  hint?: string;
  optional?: boolean;
  multiSelect?: boolean; // For checkbox type
}

// --- NEW: Postcode to State/Zone Mapping ---
interface PostcodeData {
  state: string;
  stcZone: number | null;
}

// --- NEW: Full State Name to Short Code Mapping ---
// const stateNameToShortCode: Record<string, string> = { // Keep commented out if proxy handles short codes
//   "New South Wales": "NSW",
//   Victoria: "VIC",
//   Queensland: "QLD",
//   "South Australia": "SA",
//   "Western Australia": "WA",
//   Tasmania: "TAS",
//   "Australian Capital Territory": "ACT",
//   "Northern Territory": "NT",
// };

// --- REVISED: State-Specific Incentives Interface ---
interface StateIncentives {
  // Solar Panel Incentives
  solarPanelRebateResidential?: number;
  solarPanelRebateBusiness?: number;
  solarPanelLoanResidential?: number; // If loans are specifically for panels and reduce upfront cost effectively

  // Battery Incentives
  batteryRebateResidential_amount?: number; // Direct cash rebate for residential
  batteryRebateResidential_loan?: number; // Loan amount for residential batteries
  batteryRebateBusiness_amount?: number; // Direct cash rebate for business batteries
  batteryRebateBusiness_loan?: number; // Loan amount for business batteries

  // Feed-in Tariffs (c/kWh)
  feedInTariffMin?: number;
  feedInTariffMax?: number;
  feedInTariffFixed?: number;

  // Electricity Rate ($/kWh)
  defaultStateElectricityRateKWh?: number;

  // VPP Incentives (can be a string describing the incentive)
  vppIncentive?: string;

  // General Notes
  notes?: string;
}

const FEDERAL_BATTERY_REBATE_NOTE =
  "Federal Cheaper Home Batteries Program (starts July 1, 2025): Rebate up to $372/usable kWh (approx 30% off), capped at 50kWh. For VPP-ready batteries, CEC accredited installers. Stackable. Pre-July 2025 installs eligible if not switched on until after start date.";

const stateIncentives: Record<string, StateIncentives> = {
  VIC: {
    solarPanelRebateResidential: 1400,
    solarPanelLoanResidential: 1400, // Matched loan for solar panels
    solarPanelRebateBusiness: 3500, // "Up to $3,500 for eligible businesses"
    batteryRebateResidential_loan: 8800, // Interest-free loans up to $8,800
    feedInTariffMin: 4.9,
    defaultStateElectricityRateKWh: 0.306,
    notes: `Solar Homes Program offers panel rebates and loans. Battery loans are separate. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  NSW: {
    // No direct solar panel rebate mentioned for residential or business
    batteryRebateResidential_amount: 2400, // Using the higher end of $1,600–$2,400
    vppIncentive: "$250–$400 for connecting to VPP", // Storing as string
    feedInTariffMin: 5.0,
    feedInTariffMax: 15.0,
    defaultStateElectricityRateKWh: 0.3251,
    notes: `Incentives focus on battery storage (Peak Demand Reduction Scheme) and grid participation. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  QLD: {
    solarPanelRebateResidential: 3500, // "Up to $3,500 for new installations" - assuming residential, clarify if also for business
    // No specific business solar rebate mentioned, assume same as residential or needs clarification.
    // No current state battery rebate mentioned
    feedInTariffFixed: 12.377, // In regional areas; "varies in South East Queensland" - using regional as a default fixed.
    defaultStateElectricityRateKWh: 0.314,
    notes: `Previous battery programs closed. Federal incentives apply for batteries. FiT varies in South East QLD. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  SA: {
    // No state-wide solar panel rebate.
    batteryRebateResidential_amount: 2000, // "Up to $2,000 for eligible residents in the City of Adelaide" - very specific.
    feedInTariffMin: 3.5,
    feedInTariffMax: 8.5,
    defaultStateElectricityRateKWh: 0.453,
    notes: `No state-wide solar/battery rebate; specific local government incentives like City of Adelaide for batteries. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  WA: {
    // No solar panel rebate mentioned.
    batteryRebateResidential_amount: 7500, // "Up to $7,500 starting July 1, 2025"
    feedInTariffMin: 2.25, // Off-peak
    feedInTariffMax: 10.0, // Peak
    defaultStateElectricityRateKWh: 0.308,
    notes: `No solar panel rebate. Battery incentives (e.g., Synergy, Horizon Power) vary; state rebate starts July 2025. DEBS FiT rates vary by time. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  TAS: {
    // No direct solar panel rebate.
    // No direct battery rebate.
    solarPanelLoanResidential: 10000, // Interest-free loans up to $10,000 (covers solar and batteries)
    batteryRebateResidential_loan: 10000, // Shared with solar under Energy Saver Loan Scheme.
    feedInTariffFixed: 8.935, // Fixed until June 2025
    defaultStateElectricityRateKWh: 0.295,
    notes: `Energy Saver Loan Scheme supports solar and batteries. FiT fixed till June 2025. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  ACT: {
    // No direct solar panel rebate, but loans cover it.
    batteryRebateResidential_amount: 4500, // "Up to $4,500 under the Next Gen Energy Storage Program"
    solarPanelLoanResidential: 15000, // Up to $15,000 for solar and battery installations
    batteryRebateResidential_loan: 15000, // Shared with solar.
    feedInTariffMin: 3.0,
    feedInTariffMax: 12.0,
    defaultStateElectricityRateKWh: 0.266,
    notes: `Sustainable Household Scheme offers loans and Next Gen program offers battery rebates. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  NT: {
    // No direct solar panel rebate mentioned.
    batteryRebateResidential_amount: 5000,
    batteryRebateBusiness_amount: 12000,
    feedInTariffMin: 9.33,
    feedInTariffMax: 12.1, // Assuming this is the max from "9.33c and 12.1c/kWh"
    defaultStateElectricityRateKWh: 0.35,
    notes: `Home and Business Battery Scheme grants available for adding batteries to existing or new solar. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
  DEFAULT: {
    // Fallback if state not found or no specific data
    solarPanelRebateResidential: 0,
    feedInTariffMin: 5.0, // Conservative default
    defaultStateElectricityRateKWh: 0.327, // Average of new rates
    notes: `General fallback data. ${FEDERAL_BATTERY_REBATE_NOTE}`,
  },
};

type FormData = Record<string, string | string[] | boolean | number>; // Allow number for lat/lon/zone

// Nominatim API Response Structure (simplified)
interface NominatimAddress {
  postcode?: string;
  state?: string;
  // Add other components if needed (road, city, country, etc.)
}
interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimAddress;
  boundingbox: string[];
}

// --- ADJUSTED: Calculation Configuration ---
const calculationConfig = {
  // --- System Defaults ---
  defaultSystemSizeKW: 6.6,
  defaultElectricityCostPerKWh: 0.327, // REVISED: General default electricity cost ($/kWh) - average of 2025 rates

  // --- PVWatts API ---
  pvwattsBaseUrl: "https://developer.nrel.gov/api/pvwatts/v8.json", // Using v8
  // Default PVWatts Parameters (can be overridden by user input later if needed)
  azimuth: 0, // 0=North, 90=East, 180=South, 270=West (Adjust based on common install in AU) - Use 0 for North
  tilt: 20, // Default tilt angle (degrees) - Adjust based on average AU latitude/roof pitch
  arrayType: 1, // 0=Fixed Ground, 1=Fixed Roof, 2=1-Axis Tracker, 3=1-Axis Backtracking, 4=2-Axis Tracker
  moduleType: 0, // 0=Standard, 1=Premium, 2=Thin Film
  losses: 14, // System losses percentage (default 14%)

  // --- Costing & Savings (AUD) ---
  costPerKWp: 1140, // Estimated installed cost per kWp (before rebates)
  electricityCostPerKWh: 0.327, // REVISED: Assumed average grid electricity cost ($/kWh) for savings calculation
  gridExportFactor: 0.5, // Assumed % of solar generation exported (50%) - Replaces gridOffsetFactor

  // --- STC Calculation (Small-scale Technology Certificates) ---
  stcDeemingPeriodYears: 9, // Years remaining until 2030 (as of 2022, decreases each year - check current) - UPDATE TO CURRENT YEAR!
  stcPricePerCertificate: 38.5, // Example market price per STC (AUD) - fluctuates

  // --- Environmental Impact ---
  co2TonnesPerKWhGrid: 0.0007, // Tonnes of CO2 emitted per kWh of grid electricity (VIC black coal example - use state-specific if possible)
  co2TonnesPerTreePerYear: 0.022, // Tonnes of CO2 absorbed per tree per year (example factor)

  // --- NEW: Map for estimating system size based on annual kWh consumption ---
  consumptionToSystemSizeMap: [
    { threshold: 3000, size: 3.5 }, // Up to 3000 kWh/year
    { threshold: 5000, size: 5.0 }, // Up to 5000 kWh/year
    { threshold: 7000, size: 6.6 }, // Up to 7000 kWh/year
    { threshold: 9000, size: 8.0 }, // Up to 9000 kWh/year
    { threshold: Infinity, size: 10.0 }, // Above 9000 kWh/year
  ],
};

// --- REVISED: Define all the steps ---
const steps: FormStep[] = [
  // --- Step 0: Intro (Keep Existing) ---
  {
    id: "intro",
    title: "Calculate Your Solar Potential in 60 Seconds",
    question:
      "Find out how much you could save with solar. It's quick, personalised, and completely free – no obligation.",
    type: "intro",
  },
  // --- Step 1: Property Type ---
  {
    id: "propertyType",
    title: "Step 1 – Property Type",
    question: "What type of property do you want to install solar on?",
    type: "radio",
    options: [
      { label: "House", value: "house" },
      { label: "Business", value: "business" },
      { label: "Rental property", value: "rental" },
      { label: "Farm / Rural", value: "farm_rural" },
    ],
  },
  // --- Step 2: Location ---
  {
    id: "location",
    title: "Step 2 – Location",
    question: "Where is your property located?",
    type: "address", // Use 'address' type for postcode input + potential future address lookup
    hint: "Enter your postcode to determine location-specific incentives and solar potential.",
  },
  // --- Step 3: Energy Use (REVISED) ---
  {
    id: "energyUsageDetails", // CHANGED ID
    title: "Step 3 – Your Energy Profile", // CHANGED Title
    question: "Tell us about your electricity consumption.", // CHANGED Question
    type: "customEnergyInput", // NEW type to trigger custom rendering logic
    // Options and hint removed, will be part of custom rendering
  },
  // --- Step 4: Installation Timeframe ---
  {
    id: "installTimeframe",
    title: "Step 4 – Installation Timeframe",
    question: "When are you looking to install solar?",
    type: "radio",
    optional: true, // Make this optional
    options: [
      { label: "As soon as possible", value: "asap" },
      { label: "In the next 1–3 months", value: "1_3_months" },
      { label: "Just comparing options", value: "comparing" },
      { label: "Not sure yet", value: "not_sure_yet" },
    ],
  },
  // --- Step 5: Battery Interest ---
  {
    id: "batteryInterest",
    title: "Step 5 – Battery Interest",
    question:
      "Are you interested in storing excess solar energy with a battery?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Maybe later", value: "maybe_later" },
    ],
    hint: "Batteries maximize self-consumption and provide backup power.",
  },
  // --- Step 6: Contact Capture (Replaces 'lead') ---
  {
    id: "contactCapture",
    title: "🎉 Your Tailored Solar Plan Is Ready!",
    question:
      "Let us send your results – including estimated savings & next steps.",
    type: "lead", // Use existing 'lead' type for structure, but content is new
  },
  // --- Step 7: Results (Keep Existing Structure) ---
  {
    id: "results",
    title: "🎉 Your Custom Solar Report Is Ready!",
    question:
      "Based on your inputs, we've calculated your potential savings, system size, and environmental impact.",
    type: "results",
    // Results details will be calculated by the new logic and displayed here
  },
  // --- Step 8: Thank You (Keep Existing Structure) ---
  {
    id: "thankyou",
    title: "✅ Thank You – Your Results Are on The Way!", // Updated Title
    question:
      "We've received your details. Check your email for your personalised solar plan. An expert may call if clarification is needed.", // Updated Question
    type: "thankyou",
    // Additional info for thank you page can be added in renderThankYou
  },
];

// State variables
let currentStepIndex = 0;
const formData: FormData = {};
// --- ADJUSTED: Result type to match new calculation output ---
let calculatedResultsData: Record<string, string | number> | null = null;
let currentValidationErrorComp: WFComponent<HTMLParagraphElement> | null = null; // Store ref to validation message
let addressSuggestionTimeout: ReturnType<typeof setTimeout> | null = null;
// --- ADJUSTED: Nominatim result storage ---
let selectedLocationData: {
  lat: string;
  lon: string;
  postcode?: string;
  state?: string;
  displayName: string;
} | null = null;

// Selectors
const FORM_CONTAINER_SELECTOR = ".multi-step-form";
const HIDDEN_FORM_NAME = "hidden-solar-form"; // The *name* attribute of the hidden Webflow form

// Font Awesome CDN URL
const FONT_AWESOME_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";

// --- REVISED: Axios Client for Nominatim using Netlify Proxy ---
const NOMINATIM_PROXY_URL =
  "https://solar-backend-aussolar.netlify.app/.netlify/functions/nominatim-proxy";
const nominatimConfigurator = new AxiosClientConfigurator(NOMINATIM_PROXY_URL);
// No User-Agent needed here - proxy handles it
const nominatimClient = new AxiosClient(nominatimConfigurator);

// --- REVISED: Axios Client for PVWatts using Netlify Proxy ---
const PVWATTS_PROXY_URL =
  "https://solar-backend-aussolar.netlify.app/.netlify/functions/pvwatts-proxy";
const pvwattsConfigurator = new AxiosClientConfigurator(PVWATTS_PROXY_URL);
// No API key needed here - proxy handles it
const pvwattsClient = new AxiosClient(pvwattsConfigurator);

// --- NEW: OpenElectricity Proxy URL ---
const OPENELECTRICITY_PROXY_URL =
  "https://solar-backend-aussolar.netlify.app/.netlify/functions/openelectricity-proxy";

// --- ADJUSTED: Axios Client for OpenElectricity (to use the proxy) ---
const openelectricityConfigurator = new AxiosClientConfigurator(
  OPENELECTRICITY_PROXY_URL // Use the proxy URL
);
// No API key or direct Authorization header needed here anymore, proxy handles it.
const openelectricityClient = new AxiosClient(openelectricityConfigurator);

// Main function to initialize the multi-step form
export function initMultiStepForm() {
  const head = document.head;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_AWESOME_CDN_URL;
  head.appendChild(link);

  const formContainer = new WFComponent<HTMLDivElement>(
    FORM_CONTAINER_SELECTOR
  );

  if (!formContainer.getElement()) {
    console.error(
      "Multi-step form container not found:",
      FORM_CONTAINER_SELECTOR
    );
    return;
  }

  console.log("Multi-step form initialized.");

  // --- TEMPORARY TEST: Call OpenElectricity /me endpoint via proxy ---
  const oeTestRequest = openelectricityClient.get(""); // Proxy URL is base, path is /me in proxy
  console.log("[OE Test] Calling OpenElectricity proxy for /me endpoint...");
  oeTestRequest.onData((data) => {
    console.log("[OE Test] Success! Data from /me:", data);
    // TODO: Analyze this data to understand how to get network_code and pricing.
  });
  oeTestRequest.onError((error) => {
    console.error(
      "[OE Test] Error calling OpenElectricity proxy for /me:",
      error
    );
  });
  oeTestRequest.fetch(); // Make the call
  // --- END TEMPORARY TEST ---

  renderStep(currentStepIndex, formContainer);
}

// Function to render a specific step
function renderStep(
  stepIndex: number,
  mainContainer: WFComponent<HTMLDivElement>
) {
  const step = steps[stepIndex];
  mainContainer.removeAllChildren(); // Clear previous step

  console.log(`Rendering step ${stepIndex}: ${step.id}`);

  // Common elements (Title, Question/Subtext)
  const titleComp = new WFComponent(document.createElement("h2"));
  titleComp.setText(step.title);
  titleComp.addCssClass("step-title");
  mainContainer.appendChild(titleComp);

  if (step.question) {
    const questionComp = new WFComponent(document.createElement("p"));
    questionComp.setText(step.question);
    questionComp.addCssClass(
      step.type === "results" || step.type === "thankyou"
        ? "step-subtext"
        : "step-question"
    );
    mainContainer.appendChild(questionComp);
  }

  if (step.hint && step.type !== "results" && step.type !== "thankyou") {
    const hintComp = new WFComponent(document.createElement("p"));
    hintComp.setText(step.hint);
    hintComp.addCssClass("step-hint");
    mainContainer.appendChild(hintComp);
  }

  // Step-specific content/inputs
  let contentContainer: WFComponent<HTMLDivElement> | null = null;
  if (step.type !== "results" && step.type !== "thankyou") {
    contentContainer = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    contentContainer.addCssClass("step-content-container");
    mainContainer.appendChild(contentContainer);
  }

  // --- ADJUSTED: Step rendering logic ---
  switch (step.type) {
    case "intro":
      break; // No input needed
    case "text": // Keep for potential future use, but not in current flow
      createTextInput(step, contentContainer!);
      break;
    case "address": // Use for postcode/location input
      createLocationInput(step, contentContainer!); // Use dedicated function
      break;
    case "radio":
      // Use radio for Property Type, Timeframe, Battery Interest
      createRadioInput(step, contentContainer!);
      break;
    case "customEnergyInput": // NEW: Handle custom energy inputs
      createEnergyUsageInputs(step, contentContainer!); // Call new dedicated function
      break;
    case "select": // Keep for potential future use
      createSelectInput(step, contentContainer!);
      break;
    case "checkbox": // Keep for potential future use
      createCheckboxInput(step, contentContainer!);
      break;
    case "lead": // Used for Contact Capture step
      createContactCaptureForm(step, contentContainer!); // Use dedicated function
      break;
    case "results":
      renderResults(step, mainContainer); // Logic within renderResults will change
      break;
    case "thankyou":
      renderThankYou(step, mainContainer); // Content might be adjusted
      break;
    default:
      console.warn("Unknown step type:", step.type);
  }

  // Progress indicator - Adjust total steps calculation
  if (
    step.type !== "intro" &&
    step.type !== "lead" &&
    step.type !== "results" &&
    step.type !== "thankyou"
  ) {
    addProgressIndicator(stepIndex, mainContainer);
  }

  // Navigation buttons
  addNavigation(stepIndex, mainContainer);
}

// --- Input Creation Functions ---

function createTextInput(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  const inputWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  inputWrapper.addCssClass("xa-input-wrapper"); // Wrapper for input + suggestions

  const inputComp = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  inputComp.setAttribute("type", "text");
  inputComp.setAttribute("name", step.id);
  inputComp.setAttribute("id", `input-${step.id}`);
  inputComp.setAttribute("placeholder", step.question);
  inputComp.addCssClass("xa-input");
  inputComp.addCssClass("form_input");
  // Add autocomplete='off' to prevent browser interference if needed
  inputComp.setAttribute("autocomplete", "off");

  // Pre-fill if data exists (might be full address from previous attempt/selection)
  if (formData[step.id]) {
    inputComp.setAttribute("value", formData[step.id] as string);
  }

  inputWrapper.appendChild(inputComp);

  // --- Autocomplete Logic for Address Step ---
  if (step.type === "address") {
    const suggestionsContainer = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    suggestionsContainer.addCssClass("xa-suggestions-list");
    inputWrapper.appendChild(suggestionsContainer); // Append suggestions container within wrapper

    inputComp.on("input", (event) => {
      const target = event.target as HTMLInputElement;
      const currentValue = target.value;
      handleInputChange(step.id, currentValue);
      selectedLocationData = null; // Reset selected suggestion if user types again

      // Clear previous timeout
      if (addressSuggestionTimeout) {
        clearTimeout(addressSuggestionTimeout);
      }

      // Clear suggestions if input is short
      if (currentValue.length <= 3) {
        suggestionsContainer.removeAllChildren();
        suggestionsContainer.addCssClass("hidden"); // Add hidden class
        return;
      }

      // Set new timeout
      addressSuggestionTimeout = setTimeout(() => {
        fetchAddressSuggestions(currentValue, suggestionsContainer, inputComp);
      }, 500); // 500ms debounce
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (event) => {
      if (!inputWrapper.getElement().contains(event.target as Node)) {
        suggestionsContainer.addCssClass("hidden");
      }
    });
    inputComp.on("focus", () => {
      // Show suggestions again on focus if there are items
      if (suggestionsContainer.getElement().childElementCount > 0) {
        suggestionsContainer.removeCssClass("hidden");
      }
    });
  }
  // --- End Autocomplete Logic ---

  container.appendChild(inputWrapper); // Append the wrapper to the main step container
}

// --- NEW: Function specifically for Location/Postcode input (Step 2) ---
function createLocationInput(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  const inputWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  inputWrapper.addCssClass("xa-input-wrapper");

  const inputComp = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  inputComp.setAttribute("type", "text"); // Use text for postcode input
  inputComp.setAttribute("name", "postcode"); // Directly use 'postcode' as the key
  inputComp.setAttribute("id", `input-postcode`);
  // Use pattern for basic validation - allow 4 digits
  inputComp.setAttribute("pattern", "\\d{4}");
  inputComp.setAttribute("maxlength", "4");
  inputComp.setAttribute("inputmode", "numeric"); // Hint for numeric keyboard
  inputComp.setAttribute("placeholder", "Enter 4-digit postcode"); // More specific placeholder
  inputComp.addCssClass("xa-input");
  inputComp.addCssClass("form_input");
  inputComp.setAttribute("autocomplete", "postal-code"); // Use standard autocomplete attribute

  // Pre-fill if data exists
  if (formData.postcode) {
    inputComp.setAttribute("value", formData.postcode as string);
  }

  inputComp.on("input", (event) => {
    const target = event.target as HTMLInputElement;
    let value = target.value.replace(/[^\d]/g, ""); // Allow only digits
    if (value.length > 4) {
      value = value.substring(0, 4); // Limit to 4 digits
    }
    target.value = value; // Update input field
    handleInputChange("postcode", value); // Value is already a string here
    // No suggestions needed here, validation happens on 'Next' click
  });

  inputWrapper.appendChild(inputComp);
  container.appendChild(inputWrapper);
}

// NEW Function to fetch and display address suggestions
function fetchAddressSuggestions(
  inputValue: string,
  suggestionsContainer: WFComponent<HTMLDivElement>,
  inputComp: WFComponent<HTMLInputElement>
) {
  console.log("Fetching suggestions for:", inputValue);
  suggestionsContainer.removeAllChildren(); // Clear old suggestions
  suggestionsContainer.addCssClass("hidden"); // Hide initially

  const request = nominatimClient.get<NominatimResult[]>(""); // Base URL is proxy

  request.onData((results) => {
    if (results && results.length > 0) {
      results.forEach((result) => {
        const item = new WFComponent<HTMLDivElement>(
          document.createElement("div")
        );
        item.addCssClass("xa-suggestion-item");
        item.setText(result.display_name);

        item.on("click", () => {
          inputComp.getElement().value = result.display_name; // Set input value
          // Correctly get the name attribute for formData key
          const inputName = inputComp.getAttribute("name");
          if (inputName) {
            formData[inputName] = result.display_name; // Update formData with display name
          }
          selectedLocationData = {
            lat: result.lat,
            lon: result.lon,
            postcode: result.address.postcode,
            state: result.address.state,
            displayName: result.display_name,
          }; // Store the selected result data
          suggestionsContainer.removeAllChildren(); // Clear suggestions
          suggestionsContainer.addCssClass("hidden");

          // Trigger input change manually to re-validate and enable Next button
          if (inputName) {
            handleInputChange(inputName, result.display_name);
          }
        });
        suggestionsContainer.appendChild(item);
      });
      if (results.length > 0) {
        suggestionsContainer.removeCssClass("hidden"); // Show container if results found
      }
    } else {
      console.log("No suggestions found");
    }
  });

  request.onError((error) => {
    console.error("Error fetching address suggestions:", error);
    suggestionsContainer.removeAllChildren();
    suggestionsContainer.addCssClass("hidden");
  });

  // Fetch suggestions - Proxy handles format, countrycodes, addressdetails, limit
  // Note: Viewbox biasing is not currently handled by the proxy
  request.fetch({
    q: inputValue,
    // Removed: format, countrycodes, addressdetails, limit, viewbox, bounded
  });
}

function createRadioInput(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  const fieldset = new WFComponent<HTMLFieldSetElement>(
    document.createElement("fieldset")
  );
  fieldset.addCssClass("xa-radio-group");

  step.options?.forEach((option) => {
    const wrapper = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    wrapper.addCssClass("xa-radio-option");
    wrapper.addCssClass("xa-option-wrapper");
    wrapper.addCssClass("button");

    const inputComp = new WFComponent<HTMLInputElement>(
      document.createElement("input")
    );
    inputComp.setAttribute("type", "radio");
    inputComp.setAttribute("name", step.id);
    inputComp.setAttribute("value", option.value);
    inputComp.setAttribute("id", `input-${step.id}-${option.value}`);
    inputComp.addCssClass("xa-visually-hidden");

    const labelComp = new WFComponent<HTMLLabelElement>(
      document.createElement("label")
    );
    labelComp.setAttribute("for", `input-${step.id}-${option.value}`);
    labelComp.addCssClass("xa-label");

    // Create Icon
    const iconComp = new WFComponent(document.createElement("i"));
    "fa-regular fa-circle xa-icon".split(" ").forEach((cls) => {
      if (cls) iconComp.addCssClass(cls.trim());
    });

    // Create Text Span
    const textSpan = new WFComponent(document.createElement("span"));
    textSpan.addCssClass("xa-label-text");
    textSpan.setText(option.label);

    // Append Input, Icon, and Text to Label
    labelComp.appendChild(inputComp);
    labelComp.appendChild(iconComp);
    labelComp.appendChild(textSpan);

    // Apply initial checked state and styling
    if (formData[step.id] === option.value) {
      inputComp.getElement().checked = true;
      // Update icon class directly
      iconComp.removeCssClass("fa-regular");
      iconComp.removeCssClass("fa-circle");
      iconComp.addCssClass("fa-solid");
      iconComp.addCssClass("fa-check-circle");
      wrapper.addCssClass("is-filled");
    }

    // Event listener on the INPUT
    inputComp.on("change", (event) => {
      const target = event.target as HTMLInputElement;

      // Update all wrappers/labels in the group first
      fieldset
        .getChildAsComponents<HTMLDivElement>(".xa-option-wrapper")
        .forEach((w) => {
          w.removeCssClass("is-filled");
          // Find the icon within this wrapper's label and reset it
          const otherIcon =
            w.getChildAsComponent<HTMLElement>(".xa-label .xa-icon");
          if (otherIcon && otherIcon.getElement()) {
            // CORRECTED: Reset icon classes individually
            otherIcon.removeCssClass("fa-solid");
            otherIcon.removeCssClass("fa-check-circle");
            "fa-regular fa-circle".split(" ").forEach((cls) => {
              if (cls) otherIcon.addCssClass(cls);
            });
            // Ensure xa-icon class is present
            otherIcon.addCssClass("xa-icon");
          }
        });

      // Update the selected one
      if (target.checked) {
        handleInputChange(step.id, target.value);
        const parentWrapper = new WFComponent<HTMLDivElement>(
          target.closest(".xa-option-wrapper") as HTMLDivElement
        );
        // Find the icon within the clicked label
        const currentIcon =
          parentWrapper.getChildAsComponent<HTMLElement>(".xa-label .xa-icon");
        parentWrapper.addCssClass("is-filled");
        if (currentIcon && currentIcon.getElement()) {
          // CORRECTED: Update icon classes individually
          currentIcon.removeCssClass("fa-regular");
          currentIcon.removeCssClass("fa-circle");
          "fa-solid fa-check-circle".split(" ").forEach((cls) => {
            if (cls) currentIcon.addCssClass(cls);
          });
          // Ensure xa-icon class is present
          currentIcon.addCssClass("xa-icon");
        }
      }
    });

    // Append the label (containing input, icon, text) to the wrapper
    wrapper.appendChild(labelComp);
    fieldset.appendChild(wrapper);
  });

  container.appendChild(fieldset);
}

function createSelectInput(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  const selectComp = new WFComponent<HTMLSelectElement>(
    document.createElement("select")
  );
  selectComp.setAttribute("name", step.id);
  selectComp.setAttribute("id", `input-${step.id}`);
  selectComp.addCssClass("xa-select");
  selectComp.addCssClass("form_input");

  step.options?.forEach((option) => {
    const optionComp = new WFComponent<HTMLOptionElement>(
      document.createElement("option")
    );
    optionComp.setAttribute("value", option.value);
    optionComp.setText(option.label);

    // Pre-select if data exists
    if (formData[step.id] === option.value) {
      optionComp.getElement().selected = true;
    }

    selectComp.appendChild(optionComp);
  });

  // Update state on change
  selectComp.on("change", (event) => {
    const target = event.target as HTMLSelectElement;
    handleInputChange(step.id, target.value);
  });

  container.appendChild(selectComp);
}

function createCheckboxInput(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  const fieldset = new WFComponent<HTMLFieldSetElement>(
    document.createElement("fieldset")
  );
  fieldset.addCssClass("xa-checkbox-group");
  let selectedValues = (formData[step.id] as string[]) || [];

  step.options?.forEach((option) => {
    const wrapper = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    wrapper.addCssClass("xa-checkbox-option");
    wrapper.addCssClass("xa-option-wrapper");
    wrapper.addCssClass("button");

    const inputComp = new WFComponent<HTMLInputElement>(
      document.createElement("input")
    );
    inputComp.setAttribute("type", "checkbox");
    inputComp.setAttribute("name", step.id);
    inputComp.setAttribute("value", option.value);
    inputComp.setAttribute("id", `input-${step.id}-${option.value}`);
    inputComp.addCssClass("xa-visually-hidden");

    // Create Label
    const labelComp = new WFComponent<HTMLLabelElement>(
      document.createElement("label")
    );
    labelComp.setAttribute("for", `input-${step.id}-${option.value}`);
    labelComp.addCssClass("xa-label");

    // Create Icon
    const iconComp = new WFComponent(document.createElement("i"));
    "fa-regular fa-square xa-icon".split(" ").forEach((cls) => {
      if (cls) iconComp.addCssClass(cls.trim());
    });

    // Create Text Span
    const textSpan = new WFComponent(document.createElement("span"));
    textSpan.addCssClass("xa-label-text");
    textSpan.setText(option.label);

    // Append Input, Icon, and Text to Label
    labelComp.appendChild(inputComp);
    labelComp.appendChild(iconComp);
    labelComp.appendChild(textSpan);

    // Set initial checked state and styling
    if (selectedValues.includes(option.value)) {
      inputComp.getElement().checked = true;
      // CORRECTED: Update icon classes individually
      iconComp.removeCssClass("fa-regular");
      iconComp.removeCssClass("fa-square");
      "fa-solid fa-check-square".split(" ").forEach((cls) => {
        if (cls) iconComp.addCssClass(cls);
      });
      wrapper.addCssClass("is-filled");
    }

    // Event listener on INPUT handles state changes and styling updates
    inputComp.on("change", (event) => {
      const target = event.target as HTMLInputElement;
      const parentWrapper = new WFComponent<HTMLDivElement>(
        target.closest(".xa-option-wrapper") as HTMLDivElement
      );
      // Find the icon within the clicked label
      const currentIcon =
        parentWrapper.getChildAsComponent<HTMLElement>(".xa-label .xa-icon");

      if (target.checked) {
        // Update style and icon for the checked item
        parentWrapper.addCssClass("is-filled");
        if (currentIcon && currentIcon.getElement()) {
          // CORRECTED: Update icon classes individually
          currentIcon.removeCssClass("fa-regular");
          currentIcon.removeCssClass("fa-square");
          "fa-solid fa-check-square".split(" ").forEach((cls) => {
            if (cls) currentIcon.addCssClass(cls);
          });
          // Ensure xa-icon class is present
          currentIcon.addCssClass("xa-icon");
        }

        // Handle "None of the above" exclusivity
        if (target.value === "none") {
          selectedValues = ["none"];
          // Uncheck others and update their styles/icons
          fieldset
            .getChildAsComponents<HTMLDivElement>(".xa-option-wrapper")
            .forEach((w) => {
              const input = w.getChildAsComponent<HTMLInputElement>(
                'input[type="checkbox"]'
              );
              if (
                input.getElement() &&
                input.getAttribute("value") !== "none"
              ) {
                input.getElement().checked = false;
                w.removeCssClass("is-filled");
                // Find and reset the icon in the other wrapper
                const otherIcon =
                  w.getChildAsComponent<HTMLElement>(".xa-label .xa-icon");
                if (otherIcon && otherIcon.getElement()) {
                  // CORRECTED: Reset icon classes individually
                  otherIcon.removeCssClass("fa-solid");
                  otherIcon.removeCssClass("fa-check-square");
                  "fa-regular fa-square".split(" ").forEach((cls) => {
                    if (cls) otherIcon.addCssClass(cls);
                  });
                  // Ensure xa-icon class is present
                  otherIcon.addCssClass("xa-icon");
                }
              }
            });
        } else {
          selectedValues = selectedValues.filter((v) => v !== "none");
          selectedValues.push(target.value);
          // Uncheck 'none' if another is checked and update its style/icon
          const noneWrapper = fieldset.getChildAsComponent<HTMLDivElement>(
            '.xa-option-wrapper:has(input[value="none"])'
          );
          if (noneWrapper.getElement()) {
            const noneInput = noneWrapper.getChildAsComponent<HTMLInputElement>(
              'input[value="none"]'
            );
            const noneIcon =
              noneWrapper.getChildAsComponent<HTMLElement>(
                ".xa-label .xa-icon"
              );
            if (noneInput.getElement()) noneInput.getElement().checked = false;
            noneWrapper.removeCssClass("is-filled");
            if (noneIcon && noneIcon.getElement()) {
              // CORRECTED: Reset icon classes individually
              noneIcon.removeCssClass("fa-solid");
              noneIcon.removeCssClass("fa-check-square");
              "fa-regular fa-square".split(" ").forEach((cls) => {
                if (cls) noneIcon.addCssClass(cls);
              });
              // Ensure xa-icon class is present
              noneIcon.addCssClass("xa-icon");
            }
          }
        }
      } else {
        // Update style and icon for the unchecked item
        parentWrapper.removeCssClass("is-filled");
        if (currentIcon && currentIcon.getElement()) {
          // CORRECTED: Reset icon classes individually
          currentIcon.removeCssClass("fa-solid");
          currentIcon.removeCssClass("fa-check-square");
          "fa-regular fa-square".split(" ").forEach((cls) => {
            if (cls) currentIcon.addCssClass(cls);
          });
          // Ensure xa-icon class is present
          currentIcon.addCssClass("xa-icon");
        }
        selectedValues = selectedValues.filter((v) => v !== target.value);
      }
      handleInputChange(step.id, [...new Set(selectedValues)]);
    });

    // Append label (containing input, icon, text) to wrapper
    wrapper.appendChild(labelComp);
    fieldset.appendChild(wrapper);
  });

  container.appendChild(fieldset);
}

// --- ADJUSTED: Use this for Contact Capture (Step 6) ---
function createContactCaptureForm(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  // Define fields for the contact capture step
  const fields = [
    {
      id: "emailAddress",
      label: "Email Address",
      type: "email",
      optional: false,
    },
    {
      id: "phoneNumber",
      label: "Phone Number (Optional)", // Label indicates optionality
      type: "tel",
      optional: true,
    },
  ];

  fields.forEach((field) => {
    const wrapper = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    wrapper.addCssClass("xa-form-field");

    const labelComp = new WFComponent<HTMLLabelElement>(
      document.createElement("label")
    );
    labelComp.setAttribute("for", `input-${field.id}`);
    labelComp.setText(field.label); // Don't add (Optional) here, it's in the label text
    wrapper.appendChild(labelComp);

    const inputComp = new WFComponent<HTMLInputElement>(
      document.createElement("input")
    );
    inputComp.setAttribute("type", field.type);
    inputComp.setAttribute("name", field.id);
    inputComp.setAttribute("id", `input-${field.id}`);
    inputComp.addCssClass("xa-input");
    inputComp.addCssClass("form_input");
    if (!field.optional) {
      inputComp.setAttribute("required", "required");
    }

    // Pre-fill if data exists
    if (formData[field.id]) {
      inputComp.setAttribute("value", formData[field.id] as string);
    }

    inputComp.on("input", (event) => {
      const target = event.target as HTMLInputElement;
      handleInputChange(field.id, String(target.value)); // Value is already a string here
    });

    wrapper.appendChild(inputComp);
    container.appendChild(wrapper);
  });

  // --- Consent Checkbox --- (Tailored for Contact Capture)
  const consentWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  consentWrapper.addCssClass("xa-checkbox-option"); // Re-use checkbox option style
  consentWrapper.addCssClass("xa-consent-field");
  consentWrapper.addCssClass("required"); // Add class to indicate requirement visually if needed

  const consentInput = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  consentInput.setAttribute("type", "checkbox");
  consentInput.setAttribute("name", "consent");
  consentInput.setAttribute("id", "input-consent");
  consentInput.setAttribute("required", "required"); // Form validation requirement
  consentInput.addCssClass("xa-checkbox"); // Style as needed

  const consentLabel = new WFComponent<HTMLLabelElement>(
    document.createElement("label")
  );
  consentLabel.setAttribute("for", "input-consent");
  // Use setHTML for potential links
  consentLabel.setHTML(
    'I agree to the <a href="https://aussolarsystems.webflow.io/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and understand my data will be used to send personalised solar results.'
  );
  consentLabel.addCssClass("xa-label"); // Style as needed
  consentLabel.addCssClass("xa-consent-label"); // Add a specific class for styling if needed

  // Pre-check if data exists
  if (formData["consent"] === true) {
    consentInput.getElement().checked = true;
  }

  consentInput.on("change", (event) => {
    const target = event.target as HTMLInputElement;
    handleInputChange("consent", target.checked); // Boolean is fine
  });

  consentWrapper.appendChild(consentInput);
  consentWrapper.appendChild(consentLabel);
  container.appendChild(consentWrapper);

  // --- Trust Statement ---
  const trustStatement = new WFComponent<HTMLParagraphElement>(
    document.createElement("p")
  );
  trustStatement.setHTML(
    "🔒 We never share your data without permission. 100% obligation-free."
  );
  trustStatement.addCssClass("xa-trust-statement");
  container.appendChild(trustStatement);
}

function addProgressIndicator(
  stepIndex: number,
  mainContainer: WFComponent<HTMLDivElement>
) {
  const progressContainer = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  progressContainer.addCssClass("xa-progress-indicator"); // New main class

  const totalVisibleSteps = steps.findIndex((s) => s.type === "lead"); // Steps before lead form

  // Create step markers
  for (let i = 1; i <= totalVisibleSteps; i++) {
    const stepWrapper = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    stepWrapper.addCssClass("xa-progress-step");

    const marker = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    marker.addCssClass("xa-progress-marker");

    const markerContent = new WFComponent(document.createElement("span")); // Use span for content

    if (i < stepIndex) {
      // Completed step
      stepWrapper.addCssClass("completed");
      markerContent.setHTML('<i class="fa-solid fa-check"></i>'); // Checkmark icon
    } else if (i === stepIndex) {
      // Active step
      stepWrapper.addCssClass("active");
      markerContent.setText(i.toString()); // Show step number
    } else {
      // Future step
      markerContent.setText(i.toString()); // Show step number
    }

    marker.appendChild(markerContent);
    stepWrapper.appendChild(marker);

    // Add connecting line (except for the last step)
    if (i < totalVisibleSteps) {
      const line = new WFComponent<HTMLDivElement>(
        document.createElement("div")
      );
      line.addCssClass("xa-progress-line");
      stepWrapper.appendChild(line);
    }

    progressContainer.appendChild(stepWrapper);
  }

  // --- Insertion Logic ---
  // Try to insert before the step title first
  const titleElement = mainContainer.getChildAsComponent(".step-title");
  if (titleElement && titleElement.getElement()) {
    mainContainer
      .getElement()
      .insertBefore(progressContainer.getElement(), titleElement.getElement());
  } else {
    // Fallback 1: Try inserting before the content container
    console.warn(
      "Progress Indicator: Could not find .step-title. Trying .step-content-container."
    );
    const contentContainer = mainContainer.getChildAsComponent(
      ".step-content-container"
    );
    if (contentContainer && contentContainer.getElement()) {
      mainContainer
        .getElement()
        .insertBefore(
          progressContainer.getElement(),
          contentContainer.getElement()
        );
    } else {
      // Fallback 2: Append to the main container as last resort
      console.warn(
        "Progress Indicator: Could not find insertion point. Appending to main container."
      );
      mainContainer.appendChild(progressContainer);
    }
  }
}

// --- Navigation ---

// Function to add navigation buttons
function addNavigation(
  stepIndex: number,
  mainContainer: WFComponent<HTMLDivElement>
) {
  const navContainer = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  navContainer.addCssClass("step-navigation");

  const step = steps[stepIndex];

  // Back Button
  if (stepIndex > 0) {
    const backButton = new WFComponent<HTMLButtonElement>(
      document.createElement("button")
    );
    backButton.setHTML(
      `<i class="fa-solid fa-arrow-left xa-icon-left"></i> Back`
    );
    backButton.addCssClass("xa-button");
    backButton.addCssClass("xa-button-back");
    backButton.addCssClass("button");
    backButton.addCssClass("is-filled");
    backButton.on("click", () => {
      // Clear validation message when going back
      if (
        currentValidationErrorComp &&
        currentValidationErrorComp.getElement()
      ) {
        currentValidationErrorComp.remove();
        currentValidationErrorComp = null;
      }
      currentStepIndex--;
      renderStep(currentStepIndex, mainContainer);
    });
    navContainer.appendChild(backButton);
  }

  // Next / Submit / Finish Button Logic
  let nextButtonText = "Start Calculation";
  let nextButtonIcon = "fa-solid fa-arrow-right";
  let nextButtonAction = () => {
    // Default intro action
    if (currentValidationErrorComp && currentValidationErrorComp.getElement()) {
      currentValidationErrorComp.remove();
      currentValidationErrorComp = null;
    }
    currentStepIndex++;
    renderStep(currentStepIndex, mainContainer);
  };

  if (step.type === "address") {
    nextButtonText = "Confirm Postcode";
    nextButtonIcon = "fa-solid fa-map-marker-alt"; // Different icon
    nextButtonAction = () => {
      // 1. Validate postcode format first
      const postcodeValue = formData.postcode as string;
      if (!postcodeValue || !/^\d{4}$/.test(postcodeValue)) {
        if (!currentValidationErrorComp) {
          const errorComp = new WFComponent<HTMLParagraphElement>(
            document.createElement("p")
          );
          errorComp.setText(
            "Please enter a valid 4-digit Australian postcode."
          );
          errorComp.addCssClass("xa-validation-error");
          navContainer.appendChild(errorComp);
          currentValidationErrorComp = errorComp;
        }
        return; // Stop processing
      }

      // --- Perform API Verification (using Proxy) ---
      console.log("Verifying postcode via Nominatim Proxy:", postcodeValue);
      const button =
        mainContainer.getChildAsComponent<HTMLButtonElement>(".xa-button-next");
      const searchRequest = nominatimClient.get<NominatimResult[]>(""); // Use proxy URL

      searchRequest.onLoadingChange((isLoading) => {
        if (button && button.getElement()) {
          if (isLoading) {
            button.setAttribute("disabled", "disabled");
            button.setHTML(
              `Verifying... <i class="fa-solid fa-spinner fa-spin xa-icon-right"></i>`
            );
          } else {
            // Re-enable button only if no error is currently shown
            // Error handling logic in onData/onError will keep it disabled if needed
            if (
              !currentValidationErrorComp ||
              !currentValidationErrorComp.getElement()
            ) {
              button.removeAttribute("disabled");
              button.setHTML(
                `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
              );
            }
          }
        }
      });

      searchRequest.onData((results) => {
        if (results && results.length > 0) {
          const firstResult = results[0];
          // We need lat/lon for PVWatts. Postcode from input is primary.
          if (firstResult.lat && firstResult.lon) {
            formData.lat = parseFloat(firstResult.lat);
            formData.lon = parseFloat(firstResult.lon);

            // Get state and STC zone
            let foundState = firstResult.address?.state || null;
            let determinedStateShortCode: string | null = null;
            let determinedStcZone: number | null = null;

            // --- Simplified logic: Prioritize data from an updated proxy if it provides state short code and STC zone ---
            // --- For now, assuming proxy might not yet provide STC zone, so local mapping is still attempted ---
            // --- This section needs to be aligned with the capabilities of your nominatim-proxy ---

            const mappingData = postcodeMappings[postcodeValue];

            if (mappingData) {
              determinedStcZone = mappingData.stcZone;
              determinedStateShortCode = mappingData.state; // This is already the short code from our mapping
              console.log(
                `Postcode ${postcodeValue} found directly in local mapping. State: ${determinedStateShortCode}, Zone: ${determinedStcZone}`
              );
              // if (foundState && stateNameToShortCode[foundState] && stateNameToShortCode[foundState] !== determinedStateShortCode) {
              //   console.warn(
              //     `Nominatim state for ${postcodeValue} ('${foundState}') differs from direct local mapping state ('${determinedStateShortCode}'). Using local mapping data as primary.`
              //   );
              // }
            } else if (foundState) {
              // If not in direct mapping, try to infer from Nominatim's full state name if we had stateNameToShortCode
              // determinedStateShortCode = stateNameToShortCode[foundState] || null;
              // if (determinedStateShortCode) {
              //   console.log(
              //     `Nominatim identified state for ${postcodeValue} as '${foundState}' (${determinedStateShortCode}). Trying to infer STC zone.`
              //   );
              //   const prefix = postcodeValue.substring(0, 1);
              //   let inferredZoneFound = false;
              //   for (const mapKey in postcodeMappings) {
              //     if (mapKey.startsWith(prefix) && postcodeMappings[mapKey].state === determinedStateShortCode) {
              //       determinedStcZone = postcodeMappings[mapKey].stcZone;
              //       console.log(
              //         `Inferred STC zone for ${postcodeValue} (State: ${determinedStateShortCode}, Prefix: ${prefix}) as ${determinedStcZone} based on entry for ${mapKey}.`
              //       );
              //       inferredZoneFound = true;
              //       break;
              //     }
              //   }
              //   if (!inferredZoneFound) {
              //     console.warn(
              //       `Could not infer STC zone for ${postcodeValue} in state ${determinedStateShortCode} using prefix logic.`
              //     );
              //   }
              // } else {
              //   console.warn(`Nominatim state '${foundState}' for postcode ${postcodeValue} could not be mapped to a short code.`);
              // }
              // Fallback: If nominatim gives a state, but we can't map it or find STC zone easily,
              // we might need to indicate an issue or rely on a generic/default STC zone if calculation must proceed.
              // For now, if not in direct mapping and stateNameToShortCode is not used, we rely on the proxy providing it or handle error.
              console.warn(
                `Postcode ${postcodeValue} not in direct local mapping. State from Nominatim: '${foundState}'. STC zone determination might be incomplete without proxy providing it or stateNameToShortCode mapping.`
              );
              // If your proxy is expected to return state short code and STC zone, you'd use that here.
              // For example: determinedStateShortCode = firstResult.address?.state_short_code_from_proxy;
              // determinedStcZone = firstResult.address?.stc_zone_from_proxy;
            } else {
              console.error(
                `Postcode ${postcodeValue} not in local mapping AND state could not be determined via Nominatim. Cannot reliably determine STC zone.`
              );
              if (!currentValidationErrorComp) {
                const errorComp = new WFComponent<HTMLParagraphElement>(
                  document.createElement("p")
                );
                errorComp.setText(
                  `Unable to determine all location data (especially STC zone) for postcode ${postcodeValue}. Please try a nearby major postcode or contact support.`
                );
                errorComp.addCssClass("xa-validation-error");
                navContainer.appendChild(errorComp);
                currentValidationErrorComp = errorComp;
              }
              // Keep button enabled to allow retry
              if (button && button.getElement()) {
                button.removeAttribute("disabled");
                button.setHTML(
                  `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
                );
              }
              return; // Stop processing if we can't get a state or STC zone foundation
            }

            // Check if we successfully determined state and zone
            // We must have a state for incentives and an STC zone for calculations.
            // determinedStcZone might be null if only inferred and failed, allow proceeding with warning for now if state known.
            if (determinedStateShortCode) {
              formData.state = determinedStateShortCode;
              formData.stcZone = determinedStcZone; // This can be null if inference failed
              console.log(
                `Postcode ${postcodeValue} processed -> State: '${determinedStateShortCode}', STC Zone: ${
                  determinedStcZone === null
                    ? "Not Found/Default"
                    : determinedStcZone
                }`
              );

              // Clear any previous validation error (like format error)
              if (
                currentValidationErrorComp &&
                currentValidationErrorComp.getElement()
              ) {
                currentValidationErrorComp.remove();
                currentValidationErrorComp = null;
              }

              // Proceed to next step
              currentStepIndex++;
              renderStep(currentStepIndex, mainContainer);
            } else {
              // This block should now be reached only if foundState or foundZone is still null
              // which should be prevented by the checks above, but keep as safeguard.
              console.error(
                `Critical error: Failed to determine a state for postcode ${postcodeValue} after all checks.`
              );
              // Show mapping error to user
              if (!currentValidationErrorComp) {
                const errorComp = new WFComponent<HTMLParagraphElement>(
                  document.createElement("p")
                );
                errorComp.setText(
                  `Could not find incentive data for postcode ${postcodeValue}. Please check the postcode.`
                );
                errorComp.addCssClass("xa-validation-error");
                navContainer.appendChild(errorComp);
                currentValidationErrorComp = errorComp;
              }
              // Keep button enabled to allow retry
              if (button && button.getElement()) {
                button.removeAttribute("disabled");
                button.setHTML(
                  `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
                );
              }
            }
          } else {
            console.error("Nominatim result missing lat/lon:", firstResult);
            if (!currentValidationErrorComp) {
              const errorComp = new WFComponent<HTMLParagraphElement>(
                document.createElement("p")
              );
              errorComp.setText(
                "Could not retrieve location coordinates for this postcode. Please try again."
              );
              errorComp.addCssClass("xa-validation-error");
              navContainer.appendChild(errorComp);
              currentValidationErrorComp = errorComp;
            }
          }
        } else {
          console.error(
            "No results from Nominatim for postcode:",
            postcodeValue
          );
          if (!currentValidationErrorComp) {
            const errorComp = new WFComponent<HTMLParagraphElement>(
              document.createElement("p")
            );
            errorComp.setText(
              "Postcode not found or invalid. Please check and try again."
            );
            errorComp.addCssClass("xa-validation-error");
            navContainer.appendChild(errorComp);
            currentValidationErrorComp = errorComp;
          }
        }
        // Ensure button is re-enabled after API call IF an error occurred
        if (
          currentValidationErrorComp &&
          currentValidationErrorComp.getElement() &&
          button &&
          button.getElement()
        ) {
          button.removeAttribute("disabled");
          button.setHTML(
            `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
          );
        }
      });

      searchRequest.onError((error) => {
        console.error("Nominatim API Error:", error);
        if (!currentValidationErrorComp) {
          const errorComp = new WFComponent<HTMLParagraphElement>(
            document.createElement("p")
          );
          errorComp.setText(
            "Error verifying postcode. Please check your connection or try again later."
          );
          errorComp.addCssClass("xa-validation-error");
          navContainer.appendChild(errorComp);
          currentValidationErrorComp = errorComp;
        }
        // Ensure button is re-enabled after API call IF an error occurred
        if (button && button.getElement()) {
          button.removeAttribute("disabled");
          button.setHTML(
            `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
          );
        }
      });

      // Fetch data for verification using proxy
      searchRequest.fetch({
        postalcode: postcodeValue, // Proxy expects this
        // Removed: format, addressdetails, countrycodes, limit
      });
    };
  } else if (step.type !== "intro") {
    if (step.type === "lead") {
      nextButtonText = "Show My Solar Report";
      nextButtonAction = () => {
        if (validateLeadForm()) {
          // Clear validation message on successful submit attempt
          if (
            currentValidationErrorComp &&
            currentValidationErrorComp.getElement()
          ) {
            currentValidationErrorComp.remove();
            currentValidationErrorComp = null;
          }
          handleFormSubmit(mainContainer);
        } else {
          // Only add error if one doesn't already exist
          if (!currentValidationErrorComp) {
            const errorComp = new WFComponent<HTMLParagraphElement>(
              document.createElement("p")
            );
            errorComp.setText("Please fill required fields and consent.");
            errorComp.addCssClass("xa-validation-error");
            navContainer.appendChild(errorComp);
            currentValidationErrorComp = errorComp; // Store reference
          }
        }
      };
    } else if (step.type === "results") {
      nextButtonText = "Send Me My Offer";
      nextButtonIcon = "fa-solid fa-paper-plane";
      nextButtonAction = () => {
        // Clear validation message if moving from results
        if (
          currentValidationErrorComp &&
          currentValidationErrorComp.getElement()
        ) {
          currentValidationErrorComp.remove();
          currentValidationErrorComp = null;
        }
        currentStepIndex = steps.findIndex((s) => s.id === "thankyou");
        renderStep(currentStepIndex, mainContainer);
      };
    } else if (step.type === "thankyou") {
      nextButtonText = "";
    } else {
      nextButtonText = "Next";
      nextButtonAction = () => {
        if (isStepValid(stepIndex)) {
          // Remove validation message using stored reference
          if (
            currentValidationErrorComp &&
            currentValidationErrorComp.getElement()
          ) {
            currentValidationErrorComp.remove();
            currentValidationErrorComp = null;
          }
          currentStepIndex++;
          renderStep(currentStepIndex, mainContainer);
        } else {
          // Only add error if one doesn't already exist
          if (!currentValidationErrorComp) {
            const errorComp = new WFComponent<HTMLParagraphElement>(
              document.createElement("p")
            );
            errorComp.setText("Please complete this step before continuing.");
            errorComp.addCssClass("xa-validation-error");
            navContainer.appendChild(errorComp);
            currentValidationErrorComp = errorComp; // Store reference
          }
        }
      };
    }
  }

  // Render the Next/Submit button if text is defined
  if (nextButtonText) {
    const nextButton = new WFComponent<HTMLButtonElement>(
      document.createElement("button")
    );
    nextButton.setHTML(
      `${nextButtonText} <i class="${nextButtonIcon} xa-icon-right"></i>`
    );
    nextButton.addCssClass("xa-button");
    nextButton.addCssClass("xa-button-next");
    nextButton.addCssClass("button");
    nextButton.addCssClass("is-filled");
    nextButton.on("click", nextButtonAction);

    // Initial validation checks to potentially disable
    if (
      step.type !== "intro" &&
      step.type !== "results" &&
      step.type !== "thankyou"
    ) {
      if (!isStepValid(stepIndex)) {
        nextButton.setAttribute("disabled", "disabled");
      }
    }
    if (step.type === "lead" && !validateLeadForm()) {
      nextButton.setAttribute("disabled", "disabled");
    }

    navContainer.appendChild(nextButton);
  }

  mainContainer.appendChild(navContainer);
}

// Renamed validation function for clarity
function isStepValid(stepIndex: number): boolean {
  const step = steps[stepIndex];

  // These steps have no direct input for "Next" button validation or are handled by lead form validation
  if (
    step.type === "intro" ||
    step.type === "results" ||
    step.type === "thankyou" ||
    step.type === "lead"
  ) {
    return true;
  }

  // Specific validation for location (postcode)
  if (step.id === "location") {
    const postcode = formData.postcode as string;
    // Ensure postcode is not null, undefined, or an empty string, then test pattern
    return !!postcode && /\d{4}/.test(postcode);
  }

  // Specific validation for customEnergyInput (energyUsageDetails)
  if (step.type === "customEnergyInput") {
    const billAmountStr = formData.billAmount as string | null;
    const billFrequency = formData.billFrequency as string | null;

    let isBillAmountValid = false;
    if (billAmountStr) {
      const amount = parseFloat(billAmountStr);
      isBillAmountValid = !isNaN(amount) && amount > 0;
    }

    const isBillFrequencyValid =
      !!billFrequency &&
      ["monthly", "bimonthly", "quarterly"].includes(billFrequency);

    // For the "Next" button to be enabled, both bill amount and frequency must be valid.
    // electricityCostUser is handled by defaults if not user-provided, so not a blocker for proceeding.
    return isBillAmountValid && isBillFrequencyValid;
  }

  // Standard required check for other types (radio, select, non-multi checkbox)
  if (!step.optional && step.type !== "checkbox") {
    // Exclude checkbox here, handled below
    const value = formData[step.id];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  // Validation for checkbox type (both multiSelect and single required checkbox)
  if (step.type === "checkbox") {
    const value = formData[step.id];
    if (step.multiSelect) {
      return Array.isArray(value) && value.length > 0;
    } else if (!step.optional) {
      // Single, required checkbox
      return value === true; // Assuming single required checkbox stores a boolean
    }
  }

  // If optional and data is present, or if it passed through all other checks (e.g. optional non-checkbox with data)
  return true;
}

function validateLeadForm(): boolean {
  const email = formData["emailAddress"] as string;
  const consent = formData["consent"] as boolean;
  return (
    !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && consent === true
  ); // Basic email regex
}

// Function to handle input changes
function handleInputChange(
  stepId: string,
  value: string | string[] | boolean | null
) {
  formData[stepId] = value;
  console.log("Form data updated:", formData);

  // Re-validate and enable/disable the Next button after change
  const formContainerComp = new WFComponent<HTMLDivElement>(
    FORM_CONTAINER_SELECTOR
  );
  const formElement = formContainerComp.getElement(); // Get the raw DOM element

  if (formElement) {
    // Check if form container itself exists
    // First, check if the button actually exists in the DOM
    const nextButtonElement =
      formElement.querySelector<HTMLButtonElement>(".xa-button-next");

    if (nextButtonElement) {
      // Only if the element exists, get it as a WFComponent
      const nextButton =
        formContainerComp.getChildAsComponent<HTMLButtonElement>(
          ".xa-button-next"
        );

      // Defensive check, though nextButton.getElement() should be valid if nextButtonElement was found
      if (nextButton && nextButton.getElement()) {
        let enableButton = false;
        if (steps[currentStepIndex].type === "lead") {
          enableButton = validateLeadForm();
        } else if (steps[currentStepIndex].id === "location") {
          // For postcode, only check format here. API verification happens on button click.
          enableButton = /^\d{4}$/.test(String(formData.postcode));
        } else if (steps[currentStepIndex].type === "customEnergyInput") {
          enableButton = isStepValid(currentStepIndex);
        } else {
          enableButton = isStepValid(currentStepIndex);
        }

        if (enableButton) {
          nextButton.removeAttribute("disabled");
          // Remove validation message using stored reference if input is now valid
          if (
            currentValidationErrorComp &&
            currentValidationErrorComp.getElement()
          ) {
            currentValidationErrorComp.remove();
            currentValidationErrorComp = null;
          }
        } else {
          nextButton.setAttribute("disabled", "disabled");
        }
      }
    } else {
      // .xa-button-next not found. This is expected when handleInputChange is called
      // during input initialization before addNavigation() has run for the current step.
      // console.warn("handleInputChange: .xa-button-next not found. Skipping button state update (normal during init).");
    }
  } else {
    console.warn(
      "handleInputChange: Could not find form container. Button state not updated."
    );
  }
}

// --- ADJUSTED: Make form submission async to handle calculations ---
async function handleFormSubmit(mainContainer: WFComponent<HTMLDivElement>) {
  console.log("Submitting form...", formData);
  const invisibleForm = new WFInvisibleForm(HIDDEN_FORM_NAME);

  // Filter out non-string/boolean data if necessary before submission
  // And convert arrays to comma-separated strings if needed by Webflow
  const dataToSubmit: Record<string, string> = {};
  for (const key in formData) {
    // Skip temporary/internal data not meant for the hidden form
    if (key === "calculatedResults" || key === "lat" || key === "lon") continue;

    const value = formData[key];
    if (typeof value === "string") {
      dataToSubmit[key] = value;
    } else if (Array.isArray(value)) {
      dataToSubmit[key] = value.filter((v) => v).join(", ");
    } else if (typeof value === "boolean") {
      dataToSubmit[key] = value ? "true" : "false";
    }
  }

  // --- Execute Calculation --- //
  // Disable button while calculating & submitting
  const submitButton = mainContainer.getChildAsComponent<HTMLButtonElement>(
    "button.xa-button-next"
  );
  if (submitButton.getElement()) {
    submitButton.setAttribute("disabled", "disabled");
    // Update button text to show calculation in progress
    submitButton.setHTML(
      `Calculating... <i class="fa-solid fa-spinner fa-spin xa-icon-right"></i>`
    );
  }

  try {
    const calculatedResults = await calculateResults(formData);

    // Check if calculation returned an error object
    if (calculatedResults && calculatedResults.error) {
      console.error("Calculation failed:", calculatedResults.error);
      // Show specific error message to user
      displayCalculationError(mainContainer, String(calculatedResults.error));
      // Re-enable button
      if (submitButton.getElement()) {
        submitButton.removeAttribute("disabled");
        submitButton.setHTML(
          `Show My Solar Report <i class="fa-solid fa-arrow-right xa-icon-right"></i>`
        );
      }
      return; // Stop submission process
    }

    // Merge calculated results into data *to be submitted*
    // Convert all calculated results to strings for form submission
    for (const key in calculatedResults) {
      dataToSubmit[key] = String(calculatedResults[key]);
    }

    // Store the raw calculated results (with numbers) for display
    calculatedResultsData = calculatedResults;

    // --- Submit to Webflow --- //
    invisibleForm.setFormData(dataToSubmit);
    if (submitButton.getElement()) {
      // Update button text for submission step
      submitButton.setHTML(
        `Processing... <i class="fa-solid fa-spinner fa-spin xa-icon-right"></i>` // Keep spinner
      );
    }

    // --- Set up Success/Error Handlers BEFORE submitting --- //
    invisibleForm.onSuccess(() => {
      console.log("WF Invisible Form submitted successfully!");
      // Navigate to results page (calculatedResultsData should already be set)
      // Ensure renderStep is called with the correct container reference
      const finalContainer = new WFComponent<HTMLDivElement>(
        FORM_CONTAINER_SELECTOR
      );
      if (finalContainer.getElement()) {
        currentStepIndex = steps.findIndex((s) => s.id === "results");
        if (currentStepIndex === -1) currentStepIndex = steps.length - 1; // Fallback
        renderStep(currentStepIndex, finalContainer);
      } else {
        console.error("Could not find form container for results step render.");
      }
    });

    invisibleForm.onError(() => {
      console.error("WF Invisible Form submission error");
      // Show a generic submission error; calculation itself succeeded before this
      // Need to get mainContainer reference again if possible
      const errorContainer = new WFComponent<HTMLDivElement>(
        FORM_CONTAINER_SELECTOR
      );
      if (errorContainer.getElement()) {
        displayCalculationError(
          errorContainer,
          "Oops! Something went wrong submitting your details. Please try again."
        );
        // Re-enable submit button
        const errorSubmitButton =
          errorContainer.getChildAsComponent<HTMLButtonElement>(
            "button.xa-button-next"
          );
        if (errorSubmitButton.getElement()) {
          errorSubmitButton.removeAttribute("disabled");
          errorSubmitButton.setHTML(
            `Show My Solar Report <i class="fa-solid fa-arrow-right xa-icon-right"></i>`
          );
        }
      } else {
        console.error(
          "Could not find form container to display submission error."
        );
      }
      calculatedResultsData = null; // Clear results as submission failed
    });

    invisibleForm.submitForm(); // submitForm handles success/error internally
  } catch (error) {
    // Catch any unexpected errors during calculation or submission setup
    console.error("Error during calculation/submission process:", error);
    displayCalculationError(
      mainContainer,
      "An unexpected error occurred. Please try again."
    );
    // Re-enable button
    if (submitButton.getElement()) {
      submitButton.removeAttribute("disabled");
      submitButton.setHTML(
        `Show My Solar Report <i class="fa-solid fa-arrow-right xa-icon-right"></i>`
      );
    }
  }
}

// --- NEW: Helper Function to Display Calculation Errors ---
function displayCalculationError(
  mainContainer: WFComponent<HTMLDivElement>,
  message: string
) {
  // Remove existing error messages first
  mainContainer.getChildAsComponent(".xa-calc-error-message")?.remove();

  const errorComp = new WFComponent(document.createElement("p"));
  errorComp.setText(message);
  errorComp.addCssClass("xa-error-message"); // Re-use general error style
  errorComp.addCssClass("xa-calc-error-message"); // Add specific class for removal

  // Try to insert before navigation, otherwise append
  const navContainer = mainContainer.getChildAsComponent(".step-navigation");
  if (navContainer.getElement()) {
    mainContainer
      .getElement()
      .insertBefore(errorComp.getElement(), navContainer.getElement());
  } else {
    mainContainer.appendChild(errorComp); // Fallback
  }
}

// --- REWRITTEN: Calculation Logic ---
async function calculateResults(
  data: FormData
): Promise<Record<string, string | number>> {
  console.log("--- Starting Solar Calculation ---");
  console.log("Input FormData:", JSON.parse(JSON.stringify(data))); // Deep copy for logging

  // --- 1. Essential Location Data ---
  const postcode = data.postcode as string;
  const state = data.state as string;
  const stcZone = data.stcZone as number | null;
  const lat = data.lat as number | null;
  const lon = data.lon as number | null;
  console.log(
    `Location - Postcode: ${postcode}, State: ${state}, STC Zone: ${stcZone}, Lat: ${lat}, Lon: ${lon}`
  );

  if (!postcode || !state || stcZone === null || lat === null || lon === null) {
    console.error(
      "CALC ERROR: Missing critical location data (postcode, state, STC zone, lat, or lon)."
    );
    return {
      error: "Critical location data missing. Please re-verify postcode.",
    };
  }
  const incentives = stateIncentives[state] || stateIncentives.DEFAULT;
  console.log(
    "Selected State Incentives Object:",
    JSON.parse(JSON.stringify(incentives))
  );

  // --- 2. Process Energy Usage Inputs ---
  console.log("--- Energy Usage Processing ---");
  const billAmountStr = data.billAmount as string | null;
  const billFrequency = data.billFrequency as string | null;
  const electricityCostUserStr = data.electricityCostUser as string | null;
  console.log(
    `Energy Inputs - Bill Amount: ${billAmountStr}, Frequency: ${billFrequency}, User Electricity Cost: ${electricityCostUserStr}`
  );

  let billAmount = 0;
  let annualBill = 0;
  let annualConsumptionKWh = 0;
  let systemSizeKW = calculationConfig.defaultSystemSizeKW; // Default system size

  if (
    billAmountStr &&
    !isNaN(parseFloat(billAmountStr)) &&
    parseFloat(billAmountStr) > 0
  ) {
    billAmount = parseFloat(billAmountStr);
    console.log(`Parsed Bill Amount: $${billAmount}`);
  } else {
    console.warn(
      "Bill amount is invalid or not provided. Using default system size estimation logic."
    );
  }

  let electricityRateToUse = calculationConfig.defaultElectricityCostPerKWh;
  if (incentives.defaultStateElectricityRateKWh) {
    electricityRateToUse = incentives.defaultStateElectricityRateKWh;
    console.log(
      `Using state default electricity rate for consumption calculation: $${electricityRateToUse}/kWh`
    );
  } else {
    console.log(
      `Using general default electricity rate for consumption calculation: $${electricityRateToUse}/kWh`
    );
  }

  if (
    electricityCostUserStr &&
    !isNaN(parseFloat(electricityCostUserStr)) &&
    parseFloat(electricityCostUserStr) > 0
  ) {
    // Note: electricityCostUserStr is used for *savings* calculation later if user provides it.
    // For *consumption estimation from bill*, we use system-defined rates first.
    // However, if you INTEND for user input to also override consumption calculation rate, this logic would change.
    // Current logic: user rate influences savings, system rates influence consumption if bill is given.
    console.log(
      `User defined an electricity rate: $${parseFloat(
        electricityCostUserStr
      )}/kWh (will be used for savings calc if preferred).`
    );
  }

  if (billAmount > 0 && billFrequency) {
    switch (billFrequency) {
      case "monthly":
        annualBill = billAmount * 12;
        break;
      case "bimonthly":
        annualBill = billAmount * 6;
        break;
      case "quarterly":
        annualBill = billAmount * 4;
        break;
      default:
        console.warn(
          `Invalid bill frequency: ${billFrequency}. Cannot calculate annual bill accurately.`
        );
        annualBill = 0;
    }
    console.log(`Calculated Annual Bill: $${annualBill.toFixed(2)}`);

    if (annualBill > 0 && electricityRateToUse > 0) {
      annualConsumptionKWh = annualBill / electricityRateToUse;
      console.log(
        `Estimated Annual Consumption (from bill): ${annualConsumptionKWh.toFixed(
          0
        )} kWh`
      );

      const consumptionMap = calculationConfig.consumptionToSystemSizeMap;
      systemSizeKW = calculationConfig.defaultSystemSizeKW; // Start with default
      for (const item of consumptionMap) {
        if (annualConsumptionKWh <= item.threshold) {
          systemSizeKW = item.size;
          break;
        }
      }
      console.log(
        `Estimated System Size (based on consumption): ${systemSizeKW} kWp`
      );
    } else {
      console.warn(
        "Could not estimate annual consumption from bill (annualBill or electricityRateToUse is zero). Using default system size."
      );
      console.log(`Using Default System Size: ${systemSizeKW} kWp`);
    }
  } else {
    console.log(
      "Bill amount or frequency not provided/invalid. Using default system size."
    );
    console.log(`Using Default System Size: ${systemSizeKW} kWp`);
  }

  // --- 3. Validate STC Zone (already done mostly by location check) ---
  if (stcZone === null || stcZone < 1 || stcZone > 4) {
    console.error(
      `CALC ERROR: Invalid STC Zone (${stcZone}) for postcode ${postcode}. Cannot calculate STCs.`
    );
    return {
      error:
        "Invalid STC Zone for your location. Cannot calculate incentives accurately.",
    };
  }
  console.log(`Validated STC Zone: ${stcZone}`);

  // --- 4. Call PVWatts API (via Proxy) --- //
  console.log("--- PVWatts API Call ---");
  let annualProductionAC = 0;
  try {
    const pvwattsRequest = pvwattsClient.get<{ outputs: any }>("");
    const pvwattsParams = {
      lat: lat,
      lon: lon,
      system_capacity: systemSizeKW,
      azimuth: calculationConfig.azimuth,
      tilt: calculationConfig.tilt,
    };
    console.log("Calling PVWatts Proxy with params:", pvwattsParams);

    const pvwattsResult = await pvwattsRequest.fetch(pvwattsParams);
    console.log("PVWatts Proxy Raw Response:", pvwattsResult);

    if (
      pvwattsResult &&
      pvwattsResult.outputs &&
      pvwattsResult.outputs.ac_annual
    ) {
      annualProductionAC = pvwattsResult.outputs.ac_annual;
      console.log(`PVWatts Annual AC Production: ${annualProductionAC} kWh`);
    } else {
      console.error("Invalid or missing response from PVWatts:", pvwattsResult);
      throw new Error("Failed to parse PVWatts response or ac_annual missing.");
    }
  } catch (error: any) {
    console.error("CALC ERROR: Error calling PVWatts Proxy:", error);
    let userErrorMessage =
      "Calculation Error: Could not estimate solar production.";
    if (error.code === "ERR_NETWORK") {
      userErrorMessage =
        "Network Error: Unable to reach solar data service. Please check connection or try again later.";
    } else if (error.response?.status) {
      userErrorMessage = `Solar data service error (Status: ${error.response.status}). Please try again later.`;
    }
    return {
      error: userErrorMessage,
    };
  }

  // --- 5. Calculate Costs & Rebates ---
  console.log("--- Costs & Rebates Calculation ---");
  const estimatedCost = systemSizeKW * calculationConfig.costPerKWp;
  console.log(
    `Estimated System Cost (System Size ${systemSizeKW}kWp * Cost/kWp ${
      calculationConfig.costPerKWp
    }): $${estimatedCost.toFixed(2)}`
  );

  let governmentRebate = 0;
  const propertyType = data.propertyType as string;
  console.log(`Property Type for Rebate: ${propertyType}`);

  if (propertyType === "business") {
    governmentRebate =
      incentives.solarPanelRebateBusiness ||
      incentives.solarPanelRebateResidential ||
      0;
    console.log(`Selected Business Solar Panel Rebate: $${governmentRebate}`);
  } else {
    governmentRebate = incentives.solarPanelRebateResidential || 0;
    console.log(
      `Selected Residential Solar Panel Rebate: $${governmentRebate}`
    );
  }

  const stcCount = Math.floor(
    systemSizeKW * calculationConfig.stcDeemingPeriodYears * stcZone
  );
  const stcValue = stcCount * calculationConfig.stcPricePerCertificate;
  console.log(
    `STC Calculation - System Size: ${systemSizeKW}kWp, Deeming Period: ${calculationConfig.stcDeemingPeriodYears}yrs, Zone: ${stcZone} -> STC Count: ${stcCount}`
  );
  console.log(
    `STC Value (STC Count ${stcCount} * Price/STC ${
      calculationConfig.stcPricePerCertificate
    }): $${stcValue.toFixed(2)}`
  );

  const totalGovernmentIncentives = governmentRebate + stcValue;
  console.log(
    `Total Government Incentives (Direct Rebate $${governmentRebate} + STC Value $${stcValue.toFixed(
      2
    )}): $${totalGovernmentIncentives.toFixed(2)}`
  );

  const netCost = estimatedCost - totalGovernmentIncentives;
  console.log(
    `Net Cost (Estimated Cost $${estimatedCost.toFixed(
      2
    )} - Total Incentives $${totalGovernmentIncentives.toFixed(
      2
    )}): $${netCost.toFixed(2)}`
  );

  // --- 6. Calculate Savings & Feed-in Tariff Earnings ---
  console.log("--- Savings & FiT Calculation ---");
  let fitRateCents = 0;
  if (incentives.feedInTariffFixed !== undefined) {
    fitRateCents = incentives.feedInTariffFixed;
  } else if (incentives.feedInTariffMin !== undefined) {
    fitRateCents = incentives.feedInTariffMin;
  } else {
    fitRateCents = stateIncentives.DEFAULT.feedInTariffMin || 0;
  }
  const fitRateDollars = fitRateCents / 100;
  console.log(
    `Selected FiT Rate: ${fitRateCents} c/kWh ($${fitRateDollars}/kWh)`
  );

  const annualExportKWh =
    annualProductionAC * calculationConfig.gridExportFactor;
  const annualSelfConsumptionKWh =
    annualProductionAC * (1 - calculationConfig.gridExportFactor);
  console.log(
    `Energy Flows - Annual Export: ${annualExportKWh.toFixed(
      0
    )} kWh, Annual Self-Consumption: ${annualSelfConsumptionKWh.toFixed(
      0
    )} kWh (Grid Export Factor: ${calculationConfig.gridExportFactor * 100}%)`
  );

  // Determine which electricity cost to use for calculating savings from self-consumption
  let savingElectricityRate = calculationConfig.electricityCostPerKWh; // Default general rate
  // Prefer user-defined rate if valid
  if (
    electricityCostUserStr &&
    !isNaN(parseFloat(electricityCostUserStr)) &&
    parseFloat(electricityCostUserStr) > 0
  ) {
    savingElectricityRate = parseFloat(electricityCostUserStr);
    console.log(
      `Using user-defined rate for calculating self-consumption savings: $${savingElectricityRate}/kWh`
    );
  } else if (incentives.defaultStateElectricityRateKWh) {
    // Fallback to state default if user didn't provide one
    savingElectricityRate = incentives.defaultStateElectricityRateKWh;
    console.log(
      `Using state default rate for calculating self-consumption savings: $${savingElectricityRate}/kWh`
    );
  } else {
    console.log(
      `Using general config default rate for calculating self-consumption savings: $${savingElectricityRate}/kWh`
    );
  }

  const annualSavingsFromSelfConsumption =
    annualSelfConsumptionKWh * savingElectricityRate;
  const annualFitEarnings = annualExportKWh * fitRateDollars;
  console.log(
    `Financial Benefits - Savings from Self-Consumption (Self-Consumption ${annualSelfConsumptionKWh.toFixed(
      0
    )} kWh * Rate $${savingElectricityRate}): $${annualSavingsFromSelfConsumption.toFixed(
      2
    )}`
  );
  console.log(
    `Financial Benefits - FiT Earnings (Export ${annualExportKWh.toFixed(
      0
    )} kWh * FiT Rate $${fitRateDollars}): $${annualFitEarnings.toFixed(2)}`
  );

  const totalAnnualBenefit =
    annualSavingsFromSelfConsumption + annualFitEarnings;
  console.log(
    `Total Annual Benefit (Self-Consumption Savings + FiT Earnings): $${totalAnnualBenefit.toFixed(
      2
    )}`
  );

  // --- 7. Calculate Payback & Environmental Impact ---
  console.log("--- Payback & Environmental Impact Calculation ---");
  let paybackYearsString = "N/A";
  if (netCost > 0 && totalAnnualBenefit > 0) {
    const paybackDecimal = netCost / totalAnnualBenefit;
    paybackYearsString = `Approx. ${paybackDecimal.toFixed(1)} years`;
    console.log(
      `Payback Calculation: Net Cost $${netCost.toFixed(
        2
      )} / Total Annual Benefit $${totalAnnualBenefit.toFixed(
        2
      )} = ${paybackDecimal.toFixed(1)} years`
    );
  } else if (netCost <= 0) {
    paybackYearsString = "Immediate (or profitable upfront)";
    console.log(
      `Payback Calculation: Net Cost $${netCost.toFixed(
        2
      )} <= 0. Payback is immediate or system is profitable upfront.`
    );
  } else {
    console.log(
      `Payback Calculation: Net Cost $${netCost.toFixed(
        2
      )}, Total Annual Benefit $${totalAnnualBenefit.toFixed(
        2
      )}. Payback is N/A as benefit doesn't outweigh cost or is zero.`
    );
  }

  const annualCo2ReductionTonnes =
    annualProductionAC * calculationConfig.co2TonnesPerKWhGrid;
  const equivalentTrees =
    annualCo2ReductionTonnes / calculationConfig.co2TonnesPerTreePerYear;
  console.log(
    `Environmental - Annual CO2 Reduction (Production ${annualProductionAC.toFixed(
      0
    )} kWh * CO2/kWh ${
      calculationConfig.co2TonnesPerKWhGrid
    }): ${annualCo2ReductionTonnes.toFixed(1)} tonnes/year`
  );
  console.log(
    `Environmental - Equivalent Trees (CO2 Reduction ${annualCo2ReductionTonnes.toFixed(
      1
    )} tonnes / CO2/Tree ${
      calculationConfig.co2TonnesPerTreePerYear
    }): ${Math.round(equivalentTrees)} trees/year`
  );

  // --- 8. Formatting Results --- //
  console.log("--- Formatting Final Results ---");
  const formatCurrency = (value: number) => {
    return `$${Math.round(value).toLocaleString()}`;
  };

  const batteryInterest = data.batteryInterest as string;
  let systemTypeString = "Grid-Tied Solar PV System";
  if (batteryInterest === "yes") {
    systemTypeString = "Grid-Tied System with Battery Storage";
  } else if (batteryInterest === "maybe_later") {
    systemTypeString = "Grid-Tied System (Battery Ready)";
  }
  console.log(`Determined System Type String: ${systemTypeString}`);

  const results: Record<string, string | number> = {
    // System Specs
    recommendedSystemSize: `${systemSizeKW.toFixed(1)} kWp`,
    estimatedAnnualProduction: `~${
      Math.round(annualProductionAC / 100) * 100
    } kWh/year`,
    systemType: systemTypeString,

    // Financials
    estimatedSystemCost: formatCurrency(estimatedCost),
    totalEligibleGovernmentIncentives: formatCurrency(
      totalGovernmentIncentives
    ),
    netCostAfterIncentives: formatCurrency(netCost),
    totalAnnualBenefit: formatCurrency(totalAnnualBenefit),
    paybackTime: paybackYearsString,

    // Environmental Impact
    co2Reduction: `Approx. ${annualCo2ReductionTonnes.toFixed(1)} tonnes/year`,
    equivalentTrees: `${Math.round(equivalentTrees)} trees per year`,

    // Add some key inputs/assumptions for clarity?
    locationDetected: `${postcode} (${state}, STC Zone ${stcZone})`,
    assumedElectricityRate: `${(savingElectricityRate * 100).toFixed(1)} c/kWh`, // Display the rate actually used for savings calc
    assumedFeedInTariff: `${fitRateCents.toFixed(1)} c/kWh`,
    stateIncentivesNote:
      incentives.notes ||
      "Check specific state for detailed current incentives.",
  };

  console.log(
    "Final Calculated Results Object:",
    JSON.parse(JSON.stringify(results))
  );
  console.log("--- Ending Solar Calculation ---");
  return results;
}

// --- Rendering Results and Thank You Pages Logic ---

function renderResults(
  step: FormStep,
  mainContainer: WFComponent<HTMLDivElement>
) {
  if (!calculatedResultsData) {
    console.error("Calculated results not found!");
    mainContainer.appendChild(
      createDashboardItem(
        "Error",
        "Could not load results.",
        "fa-solid fa-circle-exclamation"
      )
    );
    return;
  }

  // --- Create Dashboard Layout Container ---
  const dashboardContainer = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  dashboardContainer.addCssClass("xa-dashboard-grid"); // Use CSS Grid or Flexbox for layout
  mainContainer.appendChild(dashboardContainer);

  // --- Block 1: System Specifications ---
  const systemBlock = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  systemBlock.addCssClass("xa-dashboard-block");
  systemBlock.addCssClass("system-specs");
  const systemTitle = new WFComponent(document.createElement("h3"));
  systemTitle.setHTML(
    '<i class="fa-solid fa-solar-panel"></i> System Overview'
  );
  systemBlock.appendChild(systemTitle);

  const systemGrid = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  systemGrid.addCssClass("xa-block-content-grid"); // Inner grid for items
  const details = [
    {
      label: "Recommended System Size",
      value: calculatedResultsData.recommendedSystemSize,
      icon: "fa-solid fa-ruler-combined",
      tooltip:
        "Estimated based on your annual electricity consumption or a typical household size if consumption data is unavailable. Measured in kilowatt-peak (kWp).",
    },
    {
      label: "Estimated Annual Production",
      value: calculatedResultsData.estimatedAnnualProduction,
      icon: "fa-solid fa-bolt",
      tooltip:
        "Projected yearly electricity generation from your solar system, based on your location, system size, and NREL's PVWatts calculator. Measured in kilowatt-hours (kWh).",
    },
    {
      label: "System Type",
      value: calculatedResultsData.systemType,
      icon: "fa-solid fa-layer-group",
      tooltip:
        "Indicates if the system is grid-tied, battery-ready, or includes battery storage, based on your interest.",
    },
  ];
  details.forEach((item) =>
    systemGrid.appendChild(
      createDashboardItem(
        item.label,
        item.value,
        item.icon,
        false,
        item.tooltip
      ) // Added tooltip
    )
  );
  systemBlock.appendChild(systemGrid);
  dashboardContainer.appendChild(systemBlock);

  // --- Block 2: Financial Summary ---
  const financialBlock = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  financialBlock.addCssClass("xa-dashboard-block");
  financialBlock.addCssClass("financials");
  const financialTitle = new WFComponent(document.createElement("h3"));
  financialTitle.setHTML(
    '<i class="fa-solid fa-hand-holding-dollar"></i> Financials'
  );
  financialBlock.appendChild(financialTitle);

  const financialGrid = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  financialGrid.addCssClass("xa-block-content-grid");
  const financials = [
    {
      label: "Estimated System Cost",
      value: calculatedResultsData.estimatedSystemCost,
      icon: "fa-solid fa-file-invoice-dollar",
      tooltip:
        "Approximate upfront cost of the solar system before any rebates or incentives, based on the recommended system size and an average cost per kWp.",
    },
    {
      label: "Eligible Government Incentives", // Corrected label
      value: calculatedResultsData.totalEligibleGovernmentIncentives, // Corrected to use the combined value
      icon: "fa-solid fa-tags",
      tooltip:
        "Total estimated value of applicable government incentives, including Small-scale Technology Certificates (STCs) and any state-level solar panel rebates. This amount is typically deducted from the upfront system cost.",
    },
    {
      label: "Net Cost After Incentives",
      value: calculatedResultsData.netCostAfterIncentives,
      icon: "fa-solid fa-dollar-sign",
      highlight: true,
      tooltip:
        "The final estimated out-of-pocket expense for the solar system after all eligible rebates and STC incentives have been applied.",
    },
    {
      label: "Estimated Annual Savings",
      value: calculatedResultsData.totalAnnualBenefit,
      icon: "fa-solid fa-piggy-bank",
      highlight: true,
      tooltip:
        "Total projected financial benefit per year, combining savings from using your own solar power (reducing your electricity bill) and earnings from exporting surplus solar energy to the grid (Feed-in Tariff).",
    },
    {
      label: "Payback Time",
      value: calculatedResultsData.paybackTime,
      icon: "fa-solid fa-calendar-check",
      tooltip:
        "The estimated time it will take for your accumulated annual savings to cover the net cost of the solar system. 'N/A' if savings do not outweigh costs or if the system is profitable upfront.",
    },
  ];
  financials.forEach((item) =>
    financialGrid.appendChild(
      createDashboardItem(
        item.label,
        item.value,
        item.icon,
        item.highlight,
        item.tooltip
      ) // Added tooltip
    )
  );
  financialBlock.appendChild(financialGrid);
  dashboardContainer.appendChild(financialBlock);

  // --- Block 3: Environmental Impact ---
  const impactBlock = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  impactBlock.addCssClass("xa-dashboard-block");
  impactBlock.addCssClass("environmental");
  const impactTitle = new WFComponent(document.createElement("h3"));
  impactTitle.setHTML('<i class="fa-solid fa-leaf"></i> Environmental Impact');
  impactBlock.appendChild(impactTitle);

  const impactGrid = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  impactGrid.addCssClass("xa-block-content-grid");
  const impact = [
    {
      label: "Annual CO₂ Reduction",
      value: calculatedResultsData.co2Reduction,
      icon: "fa-solid fa-smog",
      tooltip:
        "Estimated reduction in carbon dioxide emissions per year by generating clean solar energy instead of using grid electricity, based on average grid emission factors.",
    },
    {
      label: "Equivalent Trees Planted (Yearly)",
      value: calculatedResultsData.equivalentTrees,
      icon: "fa-solid fa-tree",
      tooltip:
        "An illustrative comparison representing the amount of CO₂ your solar system is projected to offset annually, expressed as the equivalent carbon absorption of a certain number of mature trees.",
    },
  ];
  impact.forEach((item) =>
    impactGrid.appendChild(
      createDashboardItem(
        item.label,
        item.value,
        item.icon,
        false,
        item.tooltip
      ) // Added tooltip
    )
  );
  impactBlock.appendChild(impactGrid);

  const impactSubline = new WFComponent(document.createElement("p"));
  impactSubline.setText(
    "Clean energy doesn't just save money – it makes a difference."
  );
  impactSubline.addCssClass("xa-impact-subline");
  impactBlock.appendChild(impactSubline); // Add subline within the block
  dashboardContainer.appendChild(impactBlock);

  // --- Block 4: Input Summary ---
  const summaryBlock = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  summaryBlock.addCssClass("xa-dashboard-block");
  summaryBlock.addCssClass("input-summary");
  const summaryTitle = new WFComponent(document.createElement("h3"));
  summaryTitle.setHTML(
    '<i class="fa-solid fa-list-check"></i> Your Inputs & Notes'
  );
  summaryBlock.appendChild(summaryTitle);

  const summaryList = new WFComponent(document.createElement("ul"));
  summaryList.addCssClass("xa-summary-list");

  // REVISED: Input Summary Items
  const propertyTypeLabel = getLabelForValue(
    steps.find((s) => s.id === "propertyType"),
    formData.propertyType
  );
  if (propertyTypeLabel && propertyTypeLabel !== "N/A") {
    const li = new WFComponent(document.createElement("li"));
    li.setText(`Property Type: ${propertyTypeLabel}`);
    summaryList.appendChild(li);
  }

  if (formData.postcode) {
    const li = new WFComponent(document.createElement("li"));
    li.setText(`Location (Postcode): ${formData.postcode}`);
    summaryList.appendChild(li);
  }

  if (formData.billAmount && formData.billFrequency) {
    const billFreqLabel = getLabelForValue(
      {
        id: "billFrequency",
        title: "",
        question: "",
        type: "select",
        options: [
          { label: "Monthly", value: "monthly" },
          { label: "Bi-monthly", value: "bimonthly" },
          { label: "Quarterly", value: "quarterly" },
        ],
      },
      formData.billFrequency
    );
    const li = new WFComponent(document.createElement("li"));
    li.setText(
      `Avg. Bill: $${formData.billAmount} (${
        billFreqLabel || formData.billFrequency
      })`
    );
    summaryList.appendChild(li);
  }

  // Display user-provided electricity cost if available and different from default used in savings
  const userElecCost = parseFloat(formData.electricityCostUser as string);
  const configElecCost = calculationConfig.electricityCostPerKWh;
  if (
    formData.electricityCostUser &&
    !isNaN(userElecCost) &&
    userElecCost !== configElecCost
  ) {
    const li = new WFComponent(document.createElement("li"));
    li.setText(`Your Electricity Rate: ${userElecCost.toFixed(4)} $/kWh`);
    summaryList.appendChild(li);
  }

  const batteryInterestLabel = getLabelForValue(
    steps.find((s) => s.id === "batteryInterest"),
    formData.batteryInterest
  );
  if (batteryInterestLabel && batteryInterestLabel !== "N/A") {
    const li = new WFComponent(document.createElement("li"));
    li.setText(`Battery Interest: ${batteryInterestLabel}`);
    summaryList.appendChild(li);
  }

  summaryBlock.appendChild(summaryList);

  // Display State Incentives Note
  if (calculatedResultsData.stateIncentivesNote) {
    const notesTitle = new WFComponent(document.createElement("h4"));
    notesTitle.setText("Important Notes on Incentives:");
    notesTitle.addCssClass("xa-summary-notes-title");
    summaryBlock.appendChild(notesTitle);

    const notesText = new WFComponent(document.createElement("p"));
    notesText.setText(String(calculatedResultsData.stateIncentivesNote));
    notesText.addCssClass("xa-summary-notes-text");
    summaryBlock.appendChild(notesText);
  }

  dashboardContainer.appendChild(summaryBlock);

  // --- Section 5: Next Steps CTA (Below Dashboard) ---
  const nextStepsContainer = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  nextStepsContainer.addCssClass("xa-next-steps-container");
  mainContainer.appendChild(nextStepsContainer); // Append after the dashboard grid

  const nextStepsTitle = new WFComponent(document.createElement("h3"));
  nextStepsTitle.setHTML("🚀 Ready to Get Your Personal Solar Offer?");
  nextStepsTitle.addCssClass("xa-results-subtitle"); // Reuse or create new class
  nextStepsContainer.appendChild(nextStepsTitle);

  const nextStepsText = new WFComponent(document.createElement("p"));
  nextStepsText.setText(
    "Your personalised quote will now be prepared by a solar expert – free, accurate, and with no obligation to accept."
  );
  nextStepsText.addCssClass("xa-next-steps-text");
  nextStepsContainer.appendChild(nextStepsText);
}

// NEW Helper function to create individual dashboard items
function createDashboardItem(
  label: string,
  value: string | number, // Accept string or number
  iconClass: string, // Changed from icon to iconClass for clarity
  highlight: boolean = false,
  tooltipText?: string // NEW: Optional tooltip text
): WFComponent<HTMLDivElement> {
  const item = new WFComponent<HTMLDivElement>(document.createElement("div"));
  item.addCssClass("xa-dashboard-item");
  if (highlight) {
    item.addCssClass("highlight");
  }

  const iconComp = new WFComponent(document.createElement("i"));
  const faClasses = iconClass.split(" ");
  faClasses.forEach((cls) => {
    if (cls) iconComp.addCssClass(cls);
  });
  iconComp.addCssClass("xa-item-icon"); // Ensure base icon class is present

  const content = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  content.addCssClass("xa-item-content");

  const labelWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  labelWrapper.addCssClass("xa-item-label-wrapper");

  const labelComp = new WFComponent(document.createElement("p"));
  labelComp.addCssClass("xa-item-label");
  labelComp.setText(label);
  labelWrapper.appendChild(labelComp);

  // Add tooltip if text is provided
  if (tooltipText) {
    const tooltipWrapper = new WFComponent<HTMLDivElement>(
      document.createElement("div")
    );
    tooltipWrapper.addCssClass("xa-tooltip-wrapper-results");

    const tooltipIcon = new WFComponent<HTMLElement>(
      document.createElement("i")
    );
    "fa-solid fa-circle-info xa-tooltip-icon-results"
      .split(" ")
      .forEach((cls) => {
        if (cls) tooltipIcon.addCssClass(cls.trim());
      });

    const tooltipSpan = new WFComponent<HTMLSpanElement>(
      document.createElement("span")
    );
    tooltipSpan.addCssClass("xa-tooltip-text-results");
    tooltipSpan.setText(tooltipText);

    tooltipWrapper.appendChild(tooltipIcon);
    tooltipWrapper.appendChild(tooltipSpan); // This span will be shown on hover via CSS
    labelWrapper.appendChild(tooltipWrapper); // Add tooltip next to the label
  }

  const valueComp = new WFComponent(document.createElement("p"));
  valueComp.addCssClass("xa-item-value");
  valueComp.setText(
    value !== null && value !== undefined ? String(value) : "N/A"
  );

  content.appendChild(labelWrapper); // Append wrapper containing label and potentially tooltip
  content.appendChild(valueComp);

  item.appendChild(iconComp);
  item.appendChild(content);
  return item;
}

// Helper to get display label from value for summary
function getLabelForValue(step: FormStep | undefined, value: any): string {
  if (!step || !value || !step.options) return value?.toString() || "N/A";
  const option = step.options.find((opt) => opt.value === value);
  return option ? option.label : value.toString();
}

function renderThankYou(
  step: FormStep,
  mainContainer: WFComponent<HTMLDivElement>
) {
  const text = new WFComponent(document.createElement("p"));

  text.addCssClass("xa-thankyou-text");
  mainContainer.appendChild(text);

  const subTitle = new WFComponent(document.createElement("h4"));
  subTitle.setText("What happens next:");
  subTitle.addCssClass("xa-thankyou-subtitle");
  mainContainer.appendChild(subTitle);

  const list = new WFComponent(document.createElement("ul"));
  list.addCssClass("xa-thankyou-list");
  const listItems = [
    "You'll receive a call or email to confirm a few final details",
    "Then, your no-obligation solar offer will be sent",
    "You're always in control – there's no pressure to accept",
  ];
  listItems.forEach((itemText) => {
    const li = new WFComponent(document.createElement("li"));
    li.setText(itemText);
    list.appendChild(li);
  });
  mainContainer.appendChild(list);

  // Add rating/review snippet
  const rating = new WFComponent(document.createElement("div"));
  rating.addCssClass("xa-rating-snippet");
  rating.setHTML(`
    <p>⭐ 4.9/5 Average Customer Rating</p>
    <p><small>Based on 1,120 verified reviews across Australia</small></p>
    <blockquote>"Great experience! Fast, clear, and no sales pressure."<br>⭐️⭐️⭐️⭐️⭐️ – Olivia M., Brisbane</blockquote>
  `);
  mainContainer.appendChild(rating);
}

// --- NEW: Function for creating energy usage inputs (Step 3) ---
function createEnergyUsageInputs(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  // --- Outer wrapper for top row (Bill Amount and Frequency) ---
  const topRowWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  topRowWrapper.addCssClass("xa-form-row"); // For side-by-side layout

  // --- 1. Bill Amount Input ---
  const billAmountFieldWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  billAmountFieldWrapper.addCssClass("xa-form-field");
  billAmountFieldWrapper.addCssClass("xa-bill-amount-field"); // Specific class for styling

  // No explicit label, question implies it.
  // const billAmountLabel = new WFComponent<HTMLLabelElement>(document.createElement('label'));
  // billAmountLabel.setAttribute('for', 'input-billAmount');
  // billAmountLabel.setText("Average Bill Amount");
  // billAmountFieldWrapper.appendChild(billAmountLabel);

  const billAmountInputWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  billAmountInputWrapper.addCssClass("xa-input-with-suffix"); // To style input and suffix together

  const billAmountInput = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  billAmountInput.setAttribute("type", "number"); // Keep as number for numeric keyboard, validation
  billAmountInput.setAttribute("name", "billAmount");
  billAmountInput.setAttribute("id", "input-billAmount");
  billAmountInput.setAttribute("placeholder", "450"); // Default placeholder
  billAmountInput.setAttribute("min", "0");
  billAmountInput.addCssClass("xa-input");
  billAmountInput.addCssClass("form_input");

  // Pre-fill with 450 if no data, otherwise use formData
  if (formData.billAmount) {
    billAmountInput.setAttribute("value", String(formData.billAmount));
  } else {
    billAmountInput.setAttribute("value", "450"); // Default value
    handleInputChange("billAmount", "450"); // Update formData
  }

  billAmountInput.on("input", (event) => {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    // Allow empty string to be stored as null if user clears it
    handleInputChange("billAmount", value === "" ? null : value);
  });

  const billAmountUnit = new WFComponent<HTMLSpanElement>(
    document.createElement("span")
  );
  billAmountUnit.addCssClass("xa-input-suffix-text");
  billAmountUnit.setText("$");

  billAmountInputWrapper.appendChild(billAmountInput);
  billAmountInputWrapper.appendChild(billAmountUnit);
  billAmountFieldWrapper.appendChild(billAmountInputWrapper);
  topRowWrapper.appendChild(billAmountFieldWrapper);

  // --- 2. Bill Frequency (Select Dropdown) ---
  const billFrequencyFieldWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  billFrequencyFieldWrapper.addCssClass("xa-form-field");
  billFrequencyFieldWrapper.addCssClass("xa-bill-frequency-field"); // Specific class

  // const billFrequencyLabel = new WFComponent<HTMLLabelElement>(document.createElement('label'));
  // billFrequencyLabel.setAttribute('for', 'input-billFrequency');
  // billFrequencyLabel.setText("Bill Frequency");
  // billFrequencyFieldWrapper.appendChild(billFrequencyLabel);

  const billFrequencySelect = new WFComponent<HTMLSelectElement>(
    document.createElement("select")
  );
  billFrequencySelect.setAttribute("name", "billFrequency");
  billFrequencySelect.setAttribute("id", "input-billFrequency");
  billFrequencySelect.addCssClass("xa-select"); // Style as select
  billFrequencySelect.addCssClass("form_input");

  const frequencies = [
    { label: "Monthly", value: "monthly" },
    { label: "Bi-monthly", value: "bimonthly" }, // Simplified label
    { label: "Quarterly", value: "quarterly" }, // Simplified label
  ];

  frequencies.forEach((option) => {
    const optionComp = new WFComponent<HTMLOptionElement>(
      document.createElement("option")
    );
    optionComp.setAttribute("value", option.value);
    optionComp.setText(option.label);
    billFrequencySelect.appendChild(optionComp);
  });

  // Pre-select 'monthly' if no data, otherwise use formData
  if (formData.billFrequency) {
    billFrequencySelect.getElement().value = String(formData.billFrequency);
  } else {
    billFrequencySelect.getElement().value = "monthly"; // Default value
    handleInputChange("billFrequency", "monthly"); // Update formData
  }

  billFrequencySelect.on("change", (event) => {
    const target = event.target as HTMLSelectElement;
    handleInputChange("billFrequency", target.value);
  });

  billFrequencyFieldWrapper.appendChild(billFrequencySelect);
  topRowWrapper.appendChild(billFrequencyFieldWrapper);
  container.appendChild(topRowWrapper); // Add the row to the main container

  // --- 3. Electricity Cost per kWh Input (User Override) ---
  // This will now be in a new row below the first two inputs.
  const elecCostOuterWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  elecCostOuterWrapper.addCssClass("xa-form-field"); // Standard field styling
  elecCostOuterWrapper.addCssClass("xa-elec-cost-outer-wrapper"); // For specific styling/spacing

  const elecCostWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  // elecCostWrapper.addCssClass("xa-form-field"); // Moved to outer
  elecCostWrapper.addCssClass("xa-elec-cost-field"); // Specific class
  elecCostWrapper.addCssClass("xa-input-container-styled"); // Main container for this input group

  const elecCostLabelText = new WFComponent<HTMLSpanElement>(
    document.createElement("span")
  );
  elecCostLabelText.addCssClass("xa-elec-cost-label-text");
  elecCostLabelText.setText("Cost of Electricity:");
  elecCostWrapper.appendChild(elecCostLabelText);

  const elecCostInputContainer = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  elecCostInputContainer.addCssClass("xa-input-with-suffix-icon"); // For input, suffix, and icon

  const elecCostInput = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  elecCostInput.setAttribute("type", "number");
  elecCostInput.setAttribute("name", "electricityCostUser");
  elecCostInput.setAttribute("id", "input-electricityCostUser");
  elecCostInput.setAttribute("step", "0.0001");
  elecCostInput.setAttribute("min", "0");
  elecCostInput.addCssClass("xa-input");
  elecCostInput.addCssClass("form_input");

  let defaultRate = calculationConfig.defaultElectricityCostPerKWh;
  const currentPostcodeState = formData.state as string;
  if (
    currentPostcodeState &&
    stateIncentives[currentPostcodeState]?.defaultStateElectricityRateKWh
  ) {
    defaultRate =
      stateIncentives[currentPostcodeState].defaultStateElectricityRateKWh!;
  }
  const defaultRateStr = defaultRate.toFixed(4);
  elecCostInput.setAttribute("placeholder", defaultRateStr); // Placeholder shows example

  // Pre-fill logic: if formData has it, use it. Otherwise, set to default AND update formData.
  if (
    formData.electricityCostUser !== undefined &&
    formData.electricityCostUser !== null &&
    String(formData.electricityCostUser).trim() !== ""
  ) {
    elecCostInput.setAttribute("value", String(formData.electricityCostUser));
  } else {
    elecCostInput.setAttribute("value", defaultRateStr);
    handleInputChange("electricityCostUser", defaultRateStr); // Update formData with default
  }

  elecCostInput.on("input", (event) => {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    handleInputChange("electricityCostUser", value === "" ? null : value);
  });

  const elecCostUnit = new WFComponent<HTMLSpanElement>(
    document.createElement("span")
  );
  elecCostUnit.addCssClass("xa-input-suffix-text");
  elecCostUnit.setText("$"); // Suffix for cost

  elecCostInputContainer.appendChild(elecCostInput);
  elecCostInputContainer.appendChild(elecCostUnit); // Suffix next to input

  const elecCostHint = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  elecCostHint.addCssClass("xa-input-tooltip-inline-wrapper");
  const elecCostIconElement = new WFComponent<HTMLElement>(
    document.createElement("i")
  );
  "fa-solid fa-circle-info xa-tooltip-icon".split(" ").forEach((cls) => {
    if (cls) elecCostIconElement.addCssClass(cls.trim());
  });
  // Ensure xa-icon class is present
  elecCostIconElement.addCssClass("xa-tooltip-icon");

  const elecCostTooltipText = new WFComponent<HTMLSpanElement>(
    document.createElement("span")
  );
  elecCostTooltipText.addCssClass("xa-tooltip-text");
  elecCostTooltipText.setText(
    "Optional: Enter your known cost per kWh from your bill for a more accurate calculation. If unsure, leave the default."
  );

  elecCostHint.appendChild(elecCostIconElement);
  elecCostHint.appendChild(elecCostTooltipText); // Tooltip text appears on hover (CSS driven)

  elecCostInputContainer.appendChild(elecCostHint); // Info icon + tooltip part of the input group
  elecCostWrapper.appendChild(elecCostInputContainer);
  elecCostOuterWrapper.appendChild(elecCostWrapper);
  container.appendChild(elecCostOuterWrapper); // Add to the main step container
}
