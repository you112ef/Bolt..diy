import { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={classNames(
        'flex h-8 w-full rounded-md border border-bolt-elements-borderColor bg-transparent px-2 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-bolt-elements-textTertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bolt-elements-borderColorActive disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
