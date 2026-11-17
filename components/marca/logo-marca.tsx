/** Casa da marca AlugEasy (a mesma do menu interno), em `currentColor`. */
export function LogoMarca({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="M16 3L3 15H7.5V28H13.5V21H18.5V28H24.5V15H29L16 3Z" fill="currentColor" />
    </svg>
  )
}
