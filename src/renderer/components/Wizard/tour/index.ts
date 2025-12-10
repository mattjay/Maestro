/**
 * Tour Module
 *
 * Spotlight tour overlay system for guiding users through the interface.
 */

export { TourOverlay } from './TourOverlay';
export { TourStep } from './TourStep';
export { tourSteps, getTourStepById, getTourStepIndex, getTotalTourSteps } from './tourSteps';
export { useTour } from './useTour';
export type { TourStepConfig, TourUIAction, SpotlightInfo } from './useTour';
