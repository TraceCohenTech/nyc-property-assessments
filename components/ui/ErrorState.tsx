import { AlertTriangle } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description = "Try again in a moment.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-3">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center min-h-[40px] px-4 rounded-md text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-[0.97]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
