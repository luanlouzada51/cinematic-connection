import type { AvailabilityPeriod, CleaningSkill } from "@/integrations/supabase/types";

export const SKILLS: CleaningSkill[] = [
  "dusting",
  "kitchen",
  "bathroom",
  "mopping",
  "vacuum",
  "windows",
  "laundry",
  "ironing",
  "organizing",
  "deep_clean",
  "move_out",
  "office",
];

export const AVAILABILITY_PERIODS: AvailabilityPeriod[] = [
  "morning",
  "afternoon",
  "full_day",
  "night",
];
