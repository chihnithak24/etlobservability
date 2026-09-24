import toast from 'react-hot-toast';
import { 
  Lock, 
  UserX, 
  WifiOff, 
  ShieldAlert, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  AlertTriangle,
  Info,
  X 
} from 'lucide-react';

/**
 * Render a Soft Light styled toast card
 */
const renderSoftToast = (t, { variant = 'error', title, message, icon }) => {
  return (
    <div
      className={`soft-toast soft-toast-${variant} ${
        t.visible ? 'toast-enter' : 'toast-exit'
      }`}
    >
      <div className="soft-toast-icon-badge">
        {icon}
      </div>

      <div className="soft-toast-body">
        <div className="soft-toast-title">{title}</div>
        {message && <div className="soft-toast-message">{message}</div>}
      </div>

      <button
        onClick={() => toast.dismiss(t.id)}
        className="soft-toast-close"
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const authToast = {
  /**
   * Invalid password / credentials error
   */
  credentials: (title = 'Invalid Credentials', message = 'Please check your password and try again.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'error',
        title,
        message,
        icon: <Lock size={15} />
      }),
      { id: 'auth-credentials-error', duration: 4000 }
    );
  },

  /**
   * Unregistered email / account not found
   */
  accountNotFound: (title = 'Account Not Found', message = 'No account is registered with this email. Please sign up.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'error',
        title,
        message,
        icon: <UserX size={15} />
      }),
      { id: 'auth-account-not-found', duration: 4500 }
    );
  },

  /**
   * Google login / authentication failure
   */
  googleError: (title = 'Google Auth Failed', message = 'Unable to complete Google authentication. Please try again.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'error',
        title,
        message,
        icon: <ShieldAlert size={15} />
      }),
      { id: 'auth-google-error', duration: 4500 }
    );
  },

  /**
   * Server unreachable / network connection failure
   */
  networkError: (title = 'Server Connection Error', message = 'Unable to reach backend server. Please verify your network or backend connection.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'error',
        title,
        message,
        icon: <WifiOff size={15} />
      }),
      { id: 'auth-network-error', duration: 5000 }
    );
  },

  /**
   * Validation errors (missing fields, format requirements)
   */
  validationError: (title = 'Validation Required', message = 'Please fill in all required fields.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'warning',
        title,
        message,
        icon: <AlertCircle size={15} />
      }),
      { duration: 4000 }
    );
  },

  /**
   * Session expiration or unauthorized access
   */
  sessionExpired: (title = 'Session Expired', message = 'Your session has ended. Please sign in again.') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'warning',
        title,
        message,
        icon: <LogOut size={15} />
      }),
      { id: 'auth-session-expired', duration: 5000 }
    );
  },

  /**
   * General success toast
   */
  success: (title = 'Success', message = '') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'success',
        title,
        message,
        icon: <CheckCircle2 size={15} />
      }),
      { duration: 3500 }
    );
  },

  /**
   * Generic error toast fallback
   */
  error: (title = 'Authentication Error', message = '') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'error',
        title,
        message,
        icon: <AlertCircle size={15} />
      }),
      { duration: 4500 }
    );
  },

  /**
   * Generic warning toast fallback
   */
  warning: (title = 'Warning', message = '') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'warning',
        title,
        message,
        icon: <AlertTriangle size={15} />
      }),
      { duration: 4000 }
    );
  },

  /**
   * Info toast
   */
  info: (title = 'Information', message = '') => {
    return toast.custom(
      (t) => renderSoftToast(t, {
        variant: 'info',
        title,
        message,
        icon: <Info size={15} />
      }),
      { duration: 4000 }
    );
  }
};

export default authToast;
