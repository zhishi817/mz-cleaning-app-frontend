import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import GuestLuggageCard from './GuestLuggageCard'

jest.mock('./CleaningMediaImage', () => {
  const mockReact = require('react')
  const mockView = require('react-native').View
  return (props: any) => mockReact.createElement(mockView, { ...props, testID: 'guest-luggage-thumbnail' })
})
jest.mock('./CleaningMediaPreview', () => {
  const mockReact = require('react')
  const mockView = require('react-native').View
  return (props: any) => mockReact.createElement(mockView, { ...props, testID: 'guest-luggage-preview' })
})

test('uses the same saved notice context for thumbnail and preview', () => {
  const notice = {
    id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e',
    photo_urls: ['mzapp/notice-photo-1.jpg'],
    acknowledgements: { cleaners: [], inspectors: [] },
  } as any
  const ui = render(<GuestLuggageCard notice={notice} token="token-1" />)

  expect(ui.getByTestId('guest-luggage-thumbnail').props.guestLuggageId).toBe('4a0dbea0-cbaf-4eef-87ec-2f4bb038703e')
  expect(ui.getByTestId('guest-luggage-thumbnail').props.token).toBe('token-1')
  fireEvent.press(ui.getByTestId('guest-luggage-photo-0'))
  expect(ui.getByTestId('guest-luggage-preview').props.guestLuggageId).toBe('4a0dbea0-cbaf-4eef-87ec-2f4bb038703e')
  expect(ui.getByTestId('guest-luggage-preview').props.token).toBe('token-1')
})
