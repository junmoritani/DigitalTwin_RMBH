import { BiLoaderCircle } from "react-icons/bi";

function Button({
  text,
  Icon: PropIcon,
  iconPosition = "left",
  variant = "primary",
  isLoading = false,
  isSelected = false,
  onClick,
  ...rest
}) {
  // 1. Determine base and variant styles
  let baseStyles =
    "flex items-center justify-center space-x-2  py-2 px-4 rounded-lg transition duration-150 ease-in-out focus:outline-none  disabled:opacity-50 disabled:cursor-not-allowed";
  let variantStyles = "";

  switch (variant) {
    case "secondary":
      variantStyles = isSelected
        ? "bg-white  border-gray-200 ring-2 ring-gray-200 hover:bg-gray-300"
        : "bg-transparent  text-gray-800 hover:bg-gray-300";
      break;
    case "danger":
      variantStyles =
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-300";
      break;
    case "primary":
    default:
      variantStyles = isSelected
        ? "bg-PrimaryDark ring-2 ring-PrimaryLight"
        : "bg-PrimaryLight text-white hover:bg-PrimaryDark focus:ring-indigo-300 shadow-md hover:shadow-lg";
      break;
    case "complementary":
      variantStyles = isSelected
        ? "bg-PrimaryDark ring-2 ring-PrimaryLight"
        : "bg-blue-900 border-2 border-gray-200 text-white hover:bg-gray-300";
      break;
  }

  // 2. Render icon logic
  // Takes the component passed via props or the Loader2 component
  const renderIcon = (Component, isLoader = false) => (
    // React components passed as props (like lucide-react icons) automatically accept
    // standard SVG attributes like className, size, and color.
    <Component
      className={`w-5 h-5 bg-  ${isLoader ? "animate-spin" : ""}`}
      aria-hidden="true"
    />
  );

  return (
    <button
      className={`${baseStyles} ${variantStyles} `}
      onClick={!isLoading ? onClick : undefined} // Prevent click when loading
      disabled={isLoading}
      aria-pressed={isSelected}
      aria-busy={isLoading}
      {...rest}
    >
      {/* If loading, show spinner, otherwise show the icon (if provided) */}
      {(isLoading || (PropIcon && iconPosition === "left")) && (
        <div className={isLoading ? "flex items-center justify-center" : ""}>
          {isLoading
            ? renderIcon(Loader2, true)
            : PropIcon && iconPosition === "left"
            ? renderIcon(PropIcon) // Rendering the component from the Icon prop
            : null}
        </div>
      )}

      {/* Button Text */}
      <span className={isLoading ? "hidden" : ""}>{text}</span>

      {/* Show icon on the right side */}
      {
        PropIcon &&
          iconPosition === "right" &&
          !isLoading &&
          renderIcon(PropIcon) // Rendering the component from the Icon prop
      }
    </button>
  );
}
export default Button;
