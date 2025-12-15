import React from 'react';

const InputField = ({ 
  label, 
  id, 
  error, 
  className = '',
  IsOpcional, 
  ...props // Captures type, value, onChange, placeholder, etc.
}) => {
  return (
    <div className={`input-group ${className} `}>
      {/* Render label only if provided */}
      {label && (
        <label htmlFor={id} className=' font-semibold text-gray-500'>
          {label}
        </label>
      )}
      {IsOpcional && (<span className='text-gray-400 text-sm '> opcional</span>)}
      <br />
      <input
        id={id}
        className={`input-control ${error ? 'input-error' : ''}  bg-gray-100 p-2  text-gray-900 border-1 pl-3  border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white 
        resize-none transition-all`}
        {...props} // Spreads all other attributes onto the input tag
      />
      
      {/* Render error message only if it exists */}
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default InputField;