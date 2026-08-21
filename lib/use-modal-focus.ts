'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
    isFocusable(element, container)
  ))
}

function isFocusable(element: HTMLElement, container: HTMLElement) {
  if (!element.matches(FOCUSABLE_SELECTOR)) return false
  if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return false
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false

  let current: HTMLElement | null = element
  while (current && container.contains(current)) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (current === container) break
    current = current.parentElement
  }
  return true
}

type ModalFocusOptions = {
  open: boolean
  layerRef: RefObject<HTMLElement | null>
  dialogRef: RefObject<HTMLElement | null>
  getInitialFocus?: () => HTMLElement | null
  onEscape: () => void
  escapeDisabled?: boolean
  allowOutsideSelector?: string
}

/**
 * Gives a portal-backed modal the browser behavior promised by aria-modal:
 * background content becomes inert, focus starts inside the dialog, and Tab
 * cannot escape. `allowOutsideSelector` supports the app's guided-tour layer,
 * which intentionally remains interactive while it points at a real dialog.
 */
export function useModalFocus({
  open,
  layerRef,
  dialogRef,
  getInitialFocus,
  onEscape,
  escapeDisabled = false,
  allowOutsideSelector,
}: ModalFocusOptions) {
  const escapeDisabledRef = useRef(escapeDisabled)
  escapeDisabledRef.current = escapeDisabled
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!open) return
    const layer = layerRef.current
    const dialog = dialogRef.current
    if (!layer || !dialog) return

    const allowedOutside = (target: Element | null) => Boolean(
      target && allowOutsideSelector && target.closest(allowOutsideSelector),
    )
    const background = Array.from(document.body.children).filter((element): element is HTMLElement => (
      element instanceof HTMLElement && element !== layer && !allowedOutside(element)
    ))
    const previousInert = background.map((element) => ({
      element,
      inert: element.inert,
      hadAttribute: element.hasAttribute('inert'),
    }))

    for (const element of background) {
      element.inert = true
      element.setAttribute('inert', '')
    }

    const focusFirst = () => {
      const preferred = getInitialFocus?.()
      const target = preferred && dialog.contains(preferred) && isFocusable(preferred, dialog)
        ? preferred
        : focusableElements(dialog)[0] ?? dialog
      target.focus()
    }
    const frame = window.requestAnimationFrame(focusFirst)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (escapeDisabledRef.current || allowedOutside(document.activeElement)) return
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab' || event.defaultPrevented || allowedOutside(document.activeElement)) return

      const focusable = focusableElements(dialog)
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const active = document.activeElement
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialog.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target && !dialog.contains(target) && !allowedOutside(target)) focusFirst()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      for (const previous of previousInert) {
        previous.element.inert = previous.inert
        if (previous.hadAttribute) previous.element.setAttribute('inert', '')
        else previous.element.removeAttribute('inert')
      }
    }
  }, [allowOutsideSelector, dialogRef, getInitialFocus, layerRef, open])
}
