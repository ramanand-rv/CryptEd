import React from "react";

interface DeleteCourseDialogProps {
  title: string;
  deleteConfirmText: string;
  deleting: boolean;
  onConfirmTextChange: (value: string) => void;
  onClose: () => void;
  onDelete: () => void;
}

interface UnsavedChangesDialogProps {
  onCancel: () => void;
  onDiscard: () => void;
}

export const DeleteCourseDialog: React.FC<DeleteCourseDialogProps> = ({
  title,
  deleteConfirmText,
  deleting,
  onConfirmTextChange,
  onClose,
  onDelete,
}) => {
  const trimmedTitle = title.trim();
  const isDeleteDisabled =
    deleting || deleteConfirmText.trim() !== trimmedTitle || !trimmedTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Confirm deletion
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              This action cannot be undone. To confirm, type{" "}
              <span className="font-semibold text-slate-900">
                {trimmedTitle || "this course"}
              </span>{" "}
              below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(event) => onConfirmTextChange(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
            placeholder="Type the course name to confirm"
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleteDisabled}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete course"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  onCancel,
  onDiscard,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unsaved changes
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              You have unsaved changes. Going back now will discard them.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 transition"
          >
            Continue editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition"
          >
            Discard and leave
          </button>
        </div>
      </div>
    </div>
  );
};
