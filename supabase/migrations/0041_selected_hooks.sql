-- Add selected_hook_indices to track which hooks the user selected for creative generation
ALTER TABLE ad_copy_generations
  ADD COLUMN IF NOT EXISTS selected_hook_indices integer[] DEFAULT NULL;
