export const MAHJONG_CAMERA_COACH_ENABLED =
  process.env.NODE_ENV !== 'production'
  || process.env.NEXT_PUBLIC_ENABLE_MAHJONG_CAMERA_COACH === 'true'

