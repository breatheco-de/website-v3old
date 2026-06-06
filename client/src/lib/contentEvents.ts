/**
 * Content lifecycle event bus.
 *
 * This is the single place for all content lifecycle events — edit started,
 * content saved, etc. Add new events here rather than using ad-hoc
 * `dispatchEvent` / `EventEmitter` patterns elsewhere in the codebase.
 * This makes the pattern discoverable for future contributors and ensures
 * that cross-cutting concerns (like the first-edit variant prompt) only need
 * to be wired up once.
 */

// ---------------------------------------------------------------------------
// ContentUpdated — fired after a successful save
// ---------------------------------------------------------------------------

export interface ContentUpdatedPayload {
  contentType: string;
  slug: string;
  locale: string;
}

type ContentEventListener = (payload: ContentUpdatedPayload) => void;

const listeners = new Set<ContentEventListener>();

export function emitContentUpdated(payload: ContentUpdatedPayload): void {
  listeners.forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      console.error("[contentEvents] Listener error:", error);
    }
  });
}

export function subscribeToContentUpdates(listener: ContentEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// EditStarted — fired when the editor is about to open for a section
// ---------------------------------------------------------------------------

export interface EditStartedPayload {
  contentType: string;
  slug: string;
  locale: string;
  /** Zero-based index of the section the editor is opening. */
  sectionIndex?: number;
  /** The current variant slug, or empty string / undefined when on the promoted variant. */
  variant?: string;
  /** Call this to unblock the original edit action after the modal resolves. */
  resume: () => void;
}

type EditStartedListener = (payload: EditStartedPayload) => void;

const editStartedListeners = new Set<EditStartedListener>();

export function emitEditStarted(payload: EditStartedPayload): void {
  editStartedListeners.forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      console.error("[contentEvents] EditStarted listener error:", error);
    }
  });
}

export function subscribeToEditStarted(listener: EditStartedListener): () => void {
  editStartedListeners.add(listener);
  return () => {
    editStartedListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// VariantCreated — fired after a new variant is successfully created
// ---------------------------------------------------------------------------

export interface VariantCreatedPayload {
  contentType: string;
  slug: string;
  locale: string;
  variantSlug: string;
}

type VariantCreatedListener = (payload: VariantCreatedPayload) => void;

const variantCreatedListeners = new Set<VariantCreatedListener>();

export function emitVariantCreated(payload: VariantCreatedPayload): void {
  variantCreatedListeners.forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      console.error("[contentEvents] VariantCreated listener error:", error);
    }
  });
}

export function subscribeToVariantCreated(listener: VariantCreatedListener): () => void {
  variantCreatedListeners.add(listener);
  return () => {
    variantCreatedListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Editor dirty check
// ---------------------------------------------------------------------------

type EditorDirtyChecker = () => boolean;
let editorDirtyChecker: EditorDirtyChecker | null = null;

export function registerEditorDirtyCheck(checker: EditorDirtyChecker | null): void {
  editorDirtyChecker = checker;
}

export function checkEditorHasUnsavedChanges(): boolean {
  return editorDirtyChecker ? editorDirtyChecker() : false;
}
