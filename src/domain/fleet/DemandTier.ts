// Time-of-day demand tiers, ordered high >= medium >= low >= veryLow. Values
// match the TrainSchedule keys they index, so a tier can be used directly to read
// a schedule's train count.
export enum DemandTier {
  High = 'highDemand',
  Low = 'lowDemand',
  Medium = 'mediumDemand',
  VeryLow = 'veryLowDemand',
}
