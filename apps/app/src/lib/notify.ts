import { toast } from "@/lib/toast-adapter";

export type NotifyOptions = {
  action?: { label: string; onPress: () => void };
  description?: string;
};

function options({ action, description }: NotifyOptions = {}) {
  return {
    description,
    ...(action ? { action: { label: action.label, onClick: action.onPress } } : {}),
  };
}

/** The only toast surface: success, warning and error. Sonner's default info styling is blue. */
export const notify = {
  success: (title: string, data?: NotifyOptions) => toast.success(title, options(data)),
  warning: (title: string, data?: NotifyOptions) => toast.warning(title, options(data)),
  error: (title: string, data?: NotifyOptions) => toast.error(title, options(data)),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
