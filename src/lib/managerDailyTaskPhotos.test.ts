import { mergeManagerLivingRoomPhotoUrls } from './managerDailyTaskPhotos'

test('manager living-room photos prefer the plural field, retain legacy fallback, and deduplicate', () => {
  expect(mergeManagerLivingRoomPhotoUrls([
    { living_room_photo_urls: ['cleaning/living-1.jpg', 'cleaning/living-2.jpg'] },
    { living_room_photo_url: 'cleaning/living-2.jpg' },
    { living_room_photo_url: 'cleaning/living-3.jpg' },
  ])).toEqual(['cleaning/living-1.jpg', 'cleaning/living-2.jpg', 'cleaning/living-3.jpg'])
})
