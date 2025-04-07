import { keyframes } from '@emotion/react'

export const pulseAnimation = keyframes`
  0% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.03); }
  100% { opacity: 0.7; transform: scale(1); }
`

export const floatingAnimation = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(-2deg); }
  50% { transform: translateY(-12px) rotate(0deg); }
  75% { transform: translateY(-8px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`

export const fadeInAnimation = keyframes`
  0% { opacity: 0; backdrop-filter: blur(0); transform: scale(0.98); }
  100% { opacity: 1; backdrop-filter: blur(8px); transform: scale(1); }
`

export const borderFlashAnimation = keyframes`
  0% { border-color: var(--chakra-colors-flipioPrimary); }
  50% { border-color: var(--chakra-colors-flipioSecondary); }
  100% { border-color: var(--chakra-colors-flipioPrimary); }
`
