import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Lesson } from "./types";

interface LessonRowProps {
  lesson: Lesson;
  isSelected: boolean;
  isCollapsed: boolean;
  isSidebarCollapsed: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  editingTitle: string;
  isEditing: boolean;
  onCommitRename: () => void;
  onChangeTitle: (value: string) => void;
}

const LessonRow: React.FC<LessonRowProps> = ({
  lesson,
  isSelected,
  isCollapsed,
  isSidebarCollapsed,
  onSelect,
  onToggleCollapse,
  onStartRename,
  editingTitle,
  isEditing,
  onCommitRename,
  onChangeTitle,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-2xl border border-transparent px-3 py-2 transition group ${
        isSelected ? "bg-slate-100 border-slate-200" : "hover:bg-slate-50"
      } ${isDragging ? "opacity-50" : "opacity-100"}`}
      {...(isSidebarCollapsed ? attributes : {})}
      {...(isSidebarCollapsed ? listeners : {})}
      onClick={() => {
        if (isSidebarCollapsed) {
          onToggleCollapse();
        }
        onSelect();
      }}
    >
      {isOver && !isDragging && (
        <div className="absolute -top-1 left-4 right-4 h-0.5 bg-emerald-400 rounded-full" />
      )}

      <div className="flex items-start gap-3">
        {!isSidebarCollapsed && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 rounded-lg px-2 py-1 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition"
            aria-label="Drag lesson"
          >
            ⋮⋮
          </button>
        )}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              value={editingTitle}
              onChange={(event) => onChangeTitle(event.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommitRename();
                }
              }}
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:border-emerald-400 focus:outline-none"
            />
          ) : isSidebarCollapsed ? (
            <button
              type="button"
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartRename();
              }}
              className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center"
              title={lesson.title || "Untitled lesson"}
            >
              {(lesson.title || "L").trim().charAt(0).toUpperCase()}
            </button>
          ) : (
            <div>
              <p
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onStartRename();
                }}
                className="text-sm font-medium text-slate-900 truncate"
              >
                {lesson.title || "Untitled lesson"}
              </p>
              <div
                className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                  !isCollapsed && lesson.description
                    ? "max-h-10 opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <p className="text-xs text-slate-400 truncate">
                  {lesson.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonRow;
