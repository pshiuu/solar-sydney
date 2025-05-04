import { WFComponent, WFInvisibleForm } from "@xatom/core";
import { AxiosClient, AxiosClientConfigurator } from "@xatom/axios";

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
    | "address";
  options?: { label: string; value: string }[];
  hint?: string;
  optional?: boolean;
  multiSelect?: boolean; // For checkbox type
}

type FormData = Record<string, string | string[] | boolean>;

// Nominatim API Response Structure (simplified)
interface NominatimAddress {
  postcode?: string;
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

// --- Calculation Configuration ---
const calculationConfig = {
  // Technical Estimates
  kWhPerYearPerKWp: 980, // Estimated annual production (kWh) per kWp of system size
  sqMetersPerKWp: 6.6, // Estimated roof area (m^2) required per kWp

  // Costing (AUD)
  costPerKWp: 1140, // Estimated installed cost per kWp (before rebates)
  electricityCostPerKWh: 0.25, // Assumed average grid electricity cost ($/kWh)

  // Rebate Assumptions (State-specific - using postcode prefix for simplicity)
  rebates: {
    nsw: { prefix: "2", cap: 2800, ratePerKWp: 285 },
    vic: { prefix: "3", cap: 1400, ratePerKWp: 142 },
    qld: { prefix: "4", cap: 1850, ratePerKWp: 185 }, // Example - Placeholder values
    sa: { prefix: "5", cap: 1600, ratePerKWp: 160 }, // Example - Placeholder values
    wa: { prefix: "6", cap: 1500, ratePerKWp: 150 }, // Example - Placeholder values
    tas: { prefix: "7", cap: 1200, ratePerKWp: 120 }, // Example - Placeholder values
    // Add ACT (0/2?) and NT (0?) if needed, might have different schemes
  },

  // Savings & Impact
  gridOffsetFactor: 0.8, // Assumed % of solar generation that offsets grid usage (80%)
  co2TonnesPerKWh: 0.0004, // Tonnes of CO2 emitted per kWh of grid electricity (example factor)
  co2TonnesPerTreePerYear: 0.022, // Tonnes of CO2 absorbed per tree per year (example factor)
};

// Define all the steps
const steps: FormStep[] = [
  {
    id: "intro",
    title: "Calculate Your Solar Potential in 60 Seconds",
    question:
      "Find out how much you could save with solar. It's quick, personalised, and completely free – no obligation.",
    type: "intro",
  },
  {
    id: "address",
    title: "Step 1 – Location",
    question: "What's your postal code?",
    type: "address",
    hint: "We use this to find your location for accurate solar and rebate calculations.",
  },
  {
    id: "ownership",
    title: "Step 2 – Ownership",
    question: "Do you own this property?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Not sure", value: "not_sure" },
    ],
    hint: "This helps us tailor your quote. Most solar systems are installed on owner-occupied buildings.",
  },
  {
    id: "propertyType",
    title: "Step 3 – Property Type",
    question: "What kind of property is it?",
    type: "radio",
    options: [
      { label: "Detached house", value: "detached_house" },
      { label: "Apartment", value: "apartment" },
      { label: "Business / Commercial", value: "business_commercial" },
      { label: "Farm / Other", value: "farm_other" },
    ],
    hint: "We match system types based on property category.",
  },
  {
    id: "monthlyBillRange",
    title: "Step 4 – Monthly Electricity Bill",
    question: "What's your average monthly electricity bill?",
    type: "select",
    options: [
      { label: "Select range...", value: "" }, // Placeholder
      { label: "Under $100", value: "under_100" },
      { label: "$100–$200", value: "100_200" },
      { label: "$200–$300", value: "200_300" },
      { label: "Over $300", value: "over_300" },
    ],
    hint: "The higher your bill, the greater your potential savings.",
  },
  {
    id: "batteryInterest",
    title: "Step 5 – Battery Interest",
    question: "Are you interested in battery storage?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "Maybe", value: "maybe" },
      { label: "No", value: "no" },
    ],
    hint: "Battery systems can increase savings and protect against blackouts.",
  },
  {
    id: "futureUsage",
    title: "Step 6 – Future Usage",
    question: "Are you planning to install any of the following?",
    type: "checkbox",
    multiSelect: true,
    options: [
      { label: "EV charger", value: "ev_charger" },
      { label: "Pool heating", value: "pool_heating" },
      { label: "Air conditioning", value: "air_conditioning" },
      { label: "Heat pump", value: "heat_pump" },
      { label: "None of the above", value: "none" }, // Handle exclusive selection logic later
    ],
    hint: "This helps us estimate your future energy needs more accurately.",
  },
  {
    id: "roofOrientation",
    title: "Step 7 – Roof Direction",
    question: "Which direction does your roof mainly face?",
    type: "radio",
    options: [
      { label: "North", value: "north" },
      { label: "East", value: "east" },
      { label: "West", value: "west" },
      { label: "South", value: "south" },
      { label: "Mixed / Not sure", value: "mixed_not_sure" },
    ],
  },
  {
    id: "roofPitch",
    title: "Step 8 – Roof Pitch",
    question: "What's your roof angle?",
    type: "radio",
    optional: true,
    options: [
      { label: "Flat", value: "flat" },
      { label: "Slight (0–15°)", value: "slight_0_15" },
      { label: "Standard (15–30°)", value: "standard_15_30" },
      { label: "Steep (30°+)", value: "steep_30_plus" },
      { label: "Not sure", value: "not_sure" },
    ],
  },
  {
    id: "lead",
    title: "Your Results Are Ready! 🎉",
    question:
      "We've calculated your ideal solar setup based on your answers.\nEnter your details to unlock your full report – including potential savings, system size, and rebates.",
    type: "lead",
  },
  {
    id: "results",
    title: "🎉 Your Custom Solar Report Is Ready!",
    question:
      "Based on your property and energy profile, we've calculated your ideal solar system – including expected savings, system size, and ROI.",
    type: "results",
    // Results details will be calculated and displayed here
  },
  {
    id: "thankyou",
    title: "🎉 Thank You – Your Quote Is on Its Way!",
    question:
      "One of our certified solar experts will review your information and send you a personalised quote within the next 24–48 hours.",
    type: "thankyou",
    // Additional info for thank you page
  },
];

// State variables
let currentStepIndex = 0;
const formData: FormData = {};
let calculatedResultsData: Record<string, string> | null = null; // Store calculated results separately
let currentValidationErrorComp: WFComponent<HTMLParagraphElement> | null = null; // Store ref to validation message
let addressSuggestionTimeout: ReturnType<typeof setTimeout> | null = null;
let selectedSuggestionData: NominatimResult | null = null; // Store data from clicked suggestion

// Selectors
const FORM_CONTAINER_SELECTOR = ".multi-step-form";
const HIDDEN_FORM_NAME = "hidden-solar-form"; // The *name* attribute of the hidden Webflow form

// Font Awesome CDN URL
const FONT_AWESOME_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";

// --- Axios Client for Nominatim ---
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const YOUR_APP_USER_AGENT = "SolarSydneyCalculator/1.0 (YOUR_WEBSITE.COM)"; // *** REPLACE WITH YOUR ACTUAL INFO ***

const nominatimConfigurator = new AxiosClientConfigurator(NOMINATIM_BASE_URL);

nominatimConfigurator.beforeRequest((config, nextFn) => {
  // Set required User-Agent header for Nominatim using the set method
  config.headers.set("User-Agent", YOUR_APP_USER_AGENT);
  console.log("Nominatim Request Config Headers:", config.headers); // Log headers specifically
  nextFn(config);
});

const nominatimClient = new AxiosClient(nominatimConfigurator);

// Main function to initialize the multi-step form
function initMultiStepForm() {
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

  switch (step.type) {
    case "intro":
      break;
    case "text":
    case "address": // Treat address input like text initially
      createTextInput(step, contentContainer!);
      break;
    case "radio":
      createRadioInput(step, contentContainer!);
      break;
    case "select":
      createSelectInput(step, contentContainer!);
      break;
    case "checkbox":
      createCheckboxInput(step, contentContainer!);
      break;
    case "lead":
      createLeadForm(step, contentContainer!);
      break;
    case "results":
      renderResults(step, mainContainer);
      break;
    case "thankyou":
      renderThankYou(step, mainContainer);
      break;
    default:
      console.warn("Unknown step type:", step.type);
  }

  // Progress indicator
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
      selectedSuggestionData = null; // Reset selected suggestion if user types again

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

// NEW Function to fetch and display address suggestions
function fetchAddressSuggestions(
  inputValue: string,
  suggestionsContainer: WFComponent<HTMLDivElement>,
  inputComp: WFComponent<HTMLInputElement>
) {
  console.log("Fetching suggestions for:", inputValue);
  suggestionsContainer.removeAllChildren(); // Clear old suggestions
  suggestionsContainer.addCssClass("hidden"); // Hide initially

  const request = nominatimClient.get<NominatimResult[]>("/search");

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
          formData[inputComp.getAttribute("name")] = result.display_name; // Update formData with display name
          selectedSuggestionData = result; // Store the selected result data
          suggestionsContainer.removeAllChildren(); // Clear suggestions
          suggestionsContainer.addCssClass("hidden");

          // Trigger input change manually to re-validate and enable Next button
          handleInputChange(
            inputComp.getAttribute("name"),
            result.display_name
          );
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

  // Fetch suggestions with increased limit and NSW viewbox bias
  const nswViewbox = "141,-28,154,-37.5"; // lon_min, lat_max, lon_max, lat_min
  request.fetch({
    format: "jsonv2",
    q: inputValue,
    countrycodes: "AU",
    addressdetails: 1,
    limit: 10, // Increased limit
    viewbox: nswViewbox, // Added viewbox bias
    bounded: 0, // Set to 1 to *strictly* limit to viewbox, 0 to just bias
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
    iconComp.addCssClass("fa-regular");
    iconComp.addCssClass("fa-circle");
    iconComp.addCssClass("xa-icon");

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
            otherIcon.removeCssClass("fa-solid");
            otherIcon.removeCssClass("fa-check-circle");
            otherIcon.addCssClass("fa-regular");
            otherIcon.addCssClass("fa-circle");
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
          // Update icon class directly
          currentIcon.removeCssClass("fa-regular");
          currentIcon.removeCssClass("fa-circle");
          currentIcon.addCssClass("fa-solid");
          currentIcon.addCssClass("fa-check-circle");
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
    iconComp.addCssClass("fa-regular");
    iconComp.addCssClass("fa-square");
    iconComp.addCssClass("xa-icon");

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
      // Update icon class directly
      iconComp.removeCssClass("fa-regular");
      iconComp.removeCssClass("fa-square");
      iconComp.addCssClass("fa-solid");
      iconComp.addCssClass("fa-check-square");
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
          currentIcon.removeCssClass("fa-regular");
          currentIcon.removeCssClass("fa-square");
          currentIcon.addCssClass("fa-solid");
          currentIcon.addCssClass("fa-check-square");
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
                  otherIcon.removeCssClass("fa-solid");
                  otherIcon.removeCssClass("fa-check-square");
                  otherIcon.addCssClass("fa-regular");
                  otherIcon.addCssClass("fa-square");
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
              noneIcon.removeCssClass("fa-solid");
              noneIcon.removeCssClass("fa-check-square");
              noneIcon.addCssClass("fa-regular");
              noneIcon.addCssClass("fa-square");
            }
          }
        }
      } else {
        // Update style and icon for the unchecked item
        parentWrapper.removeCssClass("is-filled");
        if (currentIcon && currentIcon.getElement()) {
          currentIcon.removeCssClass("fa-solid");
          currentIcon.removeCssClass("fa-check-square");
          currentIcon.addCssClass("fa-regular");
          currentIcon.addCssClass("fa-square");
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

function createLeadForm(
  step: FormStep,
  container: WFComponent<HTMLDivElement>
) {
  // Similar structure to createTextInput, but for multiple fields
  const fields = [
    { id: "firstName", label: "First Name", type: "text", optional: true },
    {
      id: "emailAddress",
      label: "Email Address",
      type: "email",
      optional: false,
    },
    { id: "phoneNumber", label: "Phone Number", type: "tel", optional: true },
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
    labelComp.setText(`${field.label}${field.optional ? " (Optional)" : ""}`);
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
      handleInputChange(field.id, target.value);
    });

    wrapper.appendChild(inputComp);
    container.appendChild(wrapper);
  });

  // Consent Checkbox
  const consentWrapper = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  consentWrapper.addCssClass("xa-checkbox-option");
  consentWrapper.addCssClass("xa-consent-field");

  const consentInput = new WFComponent<HTMLInputElement>(
    document.createElement("input")
  );
  consentInput.setAttribute("type", "checkbox");
  consentInput.setAttribute("name", "consent");
  consentInput.setAttribute("id", "input-consent");
  consentInput.setAttribute("required", "required");
  consentInput.addCssClass("xa-checkbox");

  const consentLabel = new WFComponent<HTMLLabelElement>(
    document.createElement("label")
  );
  consentLabel.setAttribute("for", "input-consent");
  // Use setHTML to allow for links if needed later
  consentLabel.setHTML(
    "I consent to being contacted about my solar quote. By submitting you agree to our Privacy Policy"
  ); // Update text as needed
  consentLabel.addCssClass("xa-label");

  // Pre-check if data exists
  if (formData["consent"] === true) {
    consentInput.getElement().checked = true;
  }

  consentInput.on("change", (event) => {
    const target = event.target as HTMLInputElement;
    handleInputChange("consent", target.checked);
  });

  consentWrapper.appendChild(consentInput);
  consentWrapper.appendChild(consentLabel);
  container.appendChild(consentWrapper);
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
    nextButtonText = "Verify Address";
    nextButtonIcon = "fa-solid fa-location-crosshairs";
    nextButtonAction = () => {
      const addressValue = formData[step.id] as string;

      // Clear previous validation errors first
      if (
        currentValidationErrorComp &&
        currentValidationErrorComp.getElement()
      ) {
        currentValidationErrorComp.remove();
        currentValidationErrorComp = null;
      }

      // Check if the current value matches a selected suggestion
      if (
        selectedSuggestionData &&
        selectedSuggestionData.display_name === addressValue
      ) {
        console.log("Using selected suggestion data:", selectedSuggestionData);
        // Use stored data from selection
        if (
          selectedSuggestionData.address &&
          selectedSuggestionData.address.postcode
        ) {
          formData.address = selectedSuggestionData.display_name;
          formData.postcode = selectedSuggestionData.address.postcode;
          formData.lat = selectedSuggestionData.lat;
          formData.lon = selectedSuggestionData.lon;
          selectedSuggestionData = null; // Clear selected data

          // Proceed directly
          currentStepIndex++;
          renderStep(currentStepIndex, mainContainer);
          return; // Skip API verification
        } else {
          // Selected suggestion was missing postcode - force verification
          console.warn(
            "Selected suggestion missing postcode, forcing verification."
          );
          selectedSuggestionData = null; // Clear invalid selection
          // Fall through to API verification below
        }
      } else {
        // Input doesn't match a selected suggestion, or no suggestion selected
        selectedSuggestionData = null; // Ensure no stale selected data is kept
        if (!addressValue || addressValue.trim() === "") {
          // Show validation error if address is empty
          if (!currentValidationErrorComp) {
            const errorComp = new WFComponent<HTMLParagraphElement>(
              document.createElement("p")
            );
            errorComp.setText("Please enter your full street address.");
            errorComp.addCssClass("xa-validation-error");
            navContainer.appendChild(errorComp);
            currentValidationErrorComp = errorComp;
          }
          return; // Stop processing
        }
        // Fall through to API verification below
      }

      // --- Perform API Verification (if not skipped above) ---
      console.log("Verifying address via API:", addressValue);
      const button =
        mainContainer.getChildAsComponent<HTMLButtonElement>(".xa-button-next");
      const searchRequest = nominatimClient.get<NominatimResult[]>("/search");

      // ... (onLoadingChange, onData, onError handlers remain the same as previous step) ...
      searchRequest.onLoadingChange((isLoading) => {
        if (button && button.getElement()) {
          if (isLoading) {
            button.setAttribute("disabled", "disabled");
            button.setHTML(
              `Verifying... <i class="fa-solid fa-spinner fa-spin xa-icon-right"></i>`
            );
          } else {
            if (
              currentValidationErrorComp &&
              currentValidationErrorComp.getElement()
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
          if (firstResult.address && firstResult.address.postcode) {
            formData.address = firstResult.display_name;
            formData.postcode = firstResult.address.postcode;
            formData.lat = firstResult.lat;
            formData.lon = firstResult.lon;
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
            if (!currentValidationErrorComp) {
              /* ... create postcode error ... */
            }
          }
        } else {
          if (!currentValidationErrorComp) {
            /* ... create not found error ... */
          }
        }
      });
      searchRequest.onError((error) => {
        console.error("Nominatim API Error:", error);
        if (!currentValidationErrorComp) {
          /* ... create API error ... */
        }
      });

      // Fetch data for verification
      searchRequest.fetch({
        format: "jsonv2",
        q: addressValue, // Verify the actual current input value
        addressdetails: 1,
        countrycodes: "AU", // Keep restriction for verification too
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

  // Skip validation for optional steps if no data entered yet
  if (step.optional && !formData[step.id]) {
    return true;
  }

  // Standard required check
  if (
    !step.optional &&
    step.type !== "intro" &&
    step.type !== "results" &&
    step.type !== "thankyou"
  ) {
    const value = formData[step.id];
    if (step.type === "checkbox" && step.multiSelect) {
      return Array.isArray(value) && value.length > 0;
    }
    return !!value && value !== "";
  }

  // If not required or special type, it's valid by default here
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
function handleInputChange(stepId: string, value: string | string[] | boolean) {
  formData[stepId] = value;
  console.log("Form data updated:", formData);

  // Re-validate and enable/disable the Next button after change
  const formContainer = new WFComponent<HTMLDivElement>(
    FORM_CONTAINER_SELECTOR
  );
  // It might be safer to find the button within the navContainer if possible,
  // but searching the whole form container should work if IDs/classes are unique.
  const nextButton =
    formContainer.getChildAsComponent<HTMLButtonElement>(".xa-button-next");

  if (nextButton && nextButton.getElement()) {
    let enableButton = false;
    if (steps[currentStepIndex].type === "lead") {
      enableButton = validateLeadForm();
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
      // Optionally, add the validation error message *immediately* on input if it becomes invalid,
      // but the current logic adds it only on Next button click attempt.
      // If immediate feedback is desired, add similar logic to the error path in addNavigation here.
    }
  } else {
    console.warn(
      "handleInputChange: Could not find .xa-button-next to update state."
    );
  }
}

// Function to handle form submission
function handleFormSubmit(mainContainer: WFComponent<HTMLDivElement>) {
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

  // Calculate results
  const calculatedResults = calculateResults(formData);
  Object.assign(dataToSubmit, calculatedResults); // Merge calculated results into data *to be submitted*

  invisibleForm.setFormData(dataToSubmit);

  invisibleForm.onSuccess(() => {
    console.log("WF Invisible Form submitted successfully!");
    // Store calculated results for display in the separate variable
    calculatedResultsData = calculatedResults;
    currentStepIndex = steps.findIndex((s) => s.id === "results");
    if (currentStepIndex === -1) currentStepIndex = steps.length - 1;
    renderStep(currentStepIndex, mainContainer); // Pass mainContainer
  });

  // Update onError to use the correct signature (no error argument)
  invisibleForm.onError(() => {
    console.error("WF Invisible Form submission error");
    calculatedResultsData = null; // Clear any potentially stale results on error
    // Show error message
    const errorComp = new WFComponent(document.createElement("p"));
    errorComp.setText(
      "Oops! Something went wrong submitting your details. Please try again."
    );
    errorComp.addCssClass("xa-error-message");

    // Try to insert before navigation, otherwise append
    const navContainer = mainContainer.getChildAsComponent(".step-navigation");
    if (navContainer.getElement()) {
      mainContainer
        .getElement()
        .insertBefore(errorComp.getElement(), navContainer.getElement());
    } else {
      mainContainer.appendChild(errorComp); // Fallback
    }

    // Re-enable submit button
    const submitButton = mainContainer.getChildAsComponent<HTMLButtonElement>(
      "button.xa-button-next"
    );
    if (submitButton.getElement()) {
      submitButton.removeAttribute("disabled");
      submitButton.setText("Show My Solar Report →"); // Reset text
    }
  });

  // Disable button while submitting
  const submitButton = mainContainer.getChildAsComponent<HTMLButtonElement>(
    "button.xa-button-next"
  );
  if (submitButton.getElement()) {
    submitButton.setAttribute("disabled", "disabled");
    submitButton.setText("Processing...");
  }

  invisibleForm.submitForm();
}

// Placeholder for calculation logic
function calculateResults(data: FormData): Record<string, string> {
  console.log("Calculating results based on:", data);

  // --- Base Assumptions & Inputs ---
  // TODO: Adjust system size based on inputs (bill amount, future usage?)
  let systemSize = 9.8; // Example base kWp - consider making this dynamic
  const postcode = data.postcode as string;
  const batteryInterest = data.batteryInterest as string;
  const monthlyBillKey = data.monthlyBillRange as string;

  // --- Calculations using config ---
  let annualProduction = systemSize * calculationConfig.kWhPerYearPerKWp;
  let roofArea = systemSize * calculationConfig.sqMetersPerKWp;
  let systemType =
    batteryInterest === "yes" || batteryInterest === "maybe"
      ? "Grid-tied with optional battery storage"
      : "Grid-tied";
  let cost = systemSize * calculationConfig.costPerKWp;

  // Rebate calculation
  let rebate = 0;
  const postcodePrefix = postcode?.substring(0, 1);
  for (const state in calculationConfig.rebates) {
    // Type assertion needed here if iterating keys of a typed object
    const rebateInfo =
      calculationConfig.rebates[
        state as keyof typeof calculationConfig.rebates
      ];
    if (rebateInfo.prefix === postcodePrefix) {
      rebate = Math.min(rebateInfo.cap, systemSize * rebateInfo.ratePerKWp);
      break; // Found matching state
    }
  }

  let netCost = cost - rebate;

  // Savings calculation
  let annualSavings = 0;
  const billMap: Record<string, number> = {
    under_100: 80,
    "100_200": 150,
    "200_300": 250,
    over_300: 350,
  };
  const avgMonthlyBill = billMap[monthlyBillKey] || 150; // Default if key invalid
  // Savings capped by annual bill, factoring in estimated offset
  annualSavings =
    Math.min(
      avgMonthlyBill * 12,
      annualProduction * calculationConfig.electricityCostPerKWh
    ) * calculationConfig.gridOffsetFactor;

  // Payback
  let payback = netCost > 0 && annualSavings > 0 ? netCost / annualSavings : 0;

  // Environmental impact
  let co2Reduction = annualProduction * calculationConfig.co2TonnesPerKWh;
  let trees = co2Reduction / calculationConfig.co2TonnesPerTreePerYear;

  // --- Formatting Results ---
  return {
    recommendedSystemSize: `${systemSize.toFixed(1)} kWp`,
    estimatedAnnualProduction: `~${
      Math.round(annualProduction / 100) * 100
    } kWh/year`,
    requiredRoofArea: `Approx. ${Math.round(roofArea)} m²`,
    systemType: systemType,
    estimatedSystemCost: `~$${Math.round(cost / 100) * 100} AUD`,
    // Display rebate calculation (even if 0)
    eligibleGovernmentRebates: `Up to $${Math.round(rebate / 100) * 100} AUD`,
    netCostAfterRebates: `~$${Math.round(netCost / 100) * 100} AUD`,
    // Round savings to nearest $10 or $50
    estimatedAnnualSavings: `Up to $${Math.round(annualSavings / 50) * 50} AUD`,
    paybackTime: payback > 0 ? `Approx. ${payback.toFixed(1)} years` : "N/A",
    co2Reduction: `Approx. ${co2Reduction.toFixed(1)} tonnes/year`,
    equivalentTrees: `${Math.round(trees)} trees per year`,
  };
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
    },
    {
      label: "Estimated Annual Production",
      value: calculatedResultsData.estimatedAnnualProduction,
      icon: "fa-solid fa-bolt",
    },
    {
      label: "Required Roof Area",
      value: calculatedResultsData.requiredRoofArea,
      icon: "fa-solid fa-vector-square",
    },
    {
      label: "System Type",
      value: calculatedResultsData.systemType,
      icon: "fa-solid fa-layer-group",
    }, // Changed icon
  ];
  details.forEach((item) =>
    systemGrid.appendChild(
      createDashboardItem(item.label, item.value, item.icon)
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
    }, // Changed icon
    {
      label: "Eligible Government Rebates",
      value: calculatedResultsData.eligibleGovernmentRebates,
      icon: "fa-solid fa-tags",
    }, // Changed icon
    {
      label: "Net Cost After Rebates",
      value: calculatedResultsData.netCostAfterRebates,
      icon: "fa-solid fa-dollar-sign",
      highlight: true,
    }, // Highlight this
    {
      label: "Estimated Annual Savings",
      value: calculatedResultsData.estimatedAnnualSavings,
      icon: "fa-solid fa-piggy-bank",
      highlight: true,
    }, // Highlight this
    {
      label: "Payback Time",
      value: calculatedResultsData.paybackTime,
      icon: "fa-solid fa-calendar-check",
    },
  ];
  financials.forEach((item) =>
    financialGrid.appendChild(
      createDashboardItem(item.label, item.value, item.icon, item.highlight)
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
    }, // Changed icon
    {
      label: "Equivalent Trees Planted (Yearly)",
      value: calculatedResultsData.equivalentTrees,
      icon: "fa-solid fa-tree",
    },
  ];
  impact.forEach((item) =>
    impactGrid.appendChild(
      createDashboardItem(item.label, item.value, item.icon)
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
    '<i class="fa-solid fa-list-check"></i> Your Inputs Summary'
  );
  summaryBlock.appendChild(summaryTitle);

  const summaryList = new WFComponent(document.createElement("ul"));
  summaryList.addCssClass("xa-summary-list");
  const summaryItems = [
    { label: "Location", value: formData.postcode },
    {
      label: "Property type",
      value: getLabelForValue(
        steps.find((s) => s.id === "propertyType"),
        formData.propertyType
      ),
    },
    {
      label: "Monthly bill",
      value: getLabelForValue(
        steps.find((s) => s.id === "monthlyBillRange"),
        formData.monthlyBillRange
      ),
    },
    {
      label: "Roof orientation",
      value: getLabelForValue(
        steps.find((s) => s.id === "roofOrientation"),
        formData.roofOrientation
      ),
    },
    {
      label: "Battery interest",
      value: getLabelForValue(
        steps.find((s) => s.id === "batteryInterest"),
        formData.batteryInterest
      ),
    },
  ];
  summaryItems.forEach((item) => {
    if (item.value) {
      const li = new WFComponent(document.createElement("li"));
      // Maybe add small icons here too?
      li.setText(`${item.label}: ${item.value}`);
      summaryList.appendChild(li);
    }
  });
  summaryBlock.appendChild(summaryList);
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
  value: string,
  icon: string,
  highlight: boolean = false
): WFComponent<HTMLDivElement> {
  const item = new WFComponent<HTMLDivElement>(document.createElement("div"));
  item.addCssClass("xa-dashboard-item");
  if (highlight) {
    item.addCssClass("highlight");
  }

  const iconComp = new WFComponent(document.createElement("i"));
  const faClasses = icon.split(" ");
  faClasses.forEach((cls) => {
    if (cls) iconComp.addCssClass(cls);
  });
  iconComp.addCssClass("xa-item-icon");

  const content = new WFComponent<HTMLDivElement>(
    document.createElement("div")
  );
  content.addCssClass("xa-item-content");

  const labelComp = new WFComponent(document.createElement("p"));
  labelComp.addCssClass("xa-item-label");
  labelComp.setText(label);

  const valueComp = new WFComponent(document.createElement("p"));
  valueComp.addCssClass("xa-item-value");
  valueComp.setText(value || "N/A");

  content.appendChild(labelComp);
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

// Initialize the form when the script loads
initMultiStepForm();
