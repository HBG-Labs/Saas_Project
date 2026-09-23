-- The premium presentation columns were added after workspace_pages switched
-- to column-level UPDATE grants. Without this explicit grant, PostgREST lets
-- the UI read the values but rejects every font, density, width, or lock
-- change with 42501, so the optimistic control immediately snaps back.
grant update (font_family, small_text, full_width, locked)
  on table public.workspace_pages
  to authenticated;

notify pgrst, 'reload schema';
