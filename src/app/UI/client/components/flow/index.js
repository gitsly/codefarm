
import { themr } from "react-css-themr";
import { FLOW } from "../identifiers.js";
import theme from "./theme.scss";

import Flow from "./Flow.js";
import StepVirtual from "./steps/Virtual";
import StepGeneric from "./steps/Generic";
import StepCreate from "./steps/Create";
import StepStatus from "./steps/Status";

const ThemedFlow = themr(FLOW, theme)(Flow);
const ThemedStepVirtual = themr(FLOW, theme)(StepVirtual);
const ThemedStepGeneric = themr(FLOW, theme)(StepGeneric);
const ThemedStepCreate = themr(FLOW, theme)(StepCreate);
const ThemedStepStatus = themr(FLOW, theme)(StepStatus);

export default ThemedFlow;
export {
    ThemedFlow as Flow,
    ThemedStepVirtual as StepVirtual,
    ThemedStepGeneric as StepGeneric,
    ThemedStepCreate as StepCreate,
    ThemedStepStatus as StepStatus
};
