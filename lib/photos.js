const photos = {
  Home: '/images/stays/home.jpg',
  Apartment: '/images/stays/apartment.jpg',
  Cabin: '/images/stays/cabin.jpg',
  Villa: '/images/stays/villa.jpg',
  Hotel: '/images/stays/hotel.jpg',
};
function photoFor(listing) {
  const image = listing.image || '';
  return !image || image.includes('placehold.co') || image === photos.Home
    ? photos[listing.category] || photos.Home
    : image;
}
const roomPhotos = {
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85':
    '/images/stays/bedroom.jpg',
  'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14':
    '/images/stays/bathroom.jpg',
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace':
    '/images/stays/dining.jpg',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0':
    '/images/stays/apartment.jpg',
};
function galleryFor(listing) {
  return [
    ...new Set([
      photoFor(listing),
      ...(listing.gallery || []).map((photo) => roomPhotos[photo] || photo),
    ]),
  ].slice(0, 5);
}
module.exports = { photos, photoFor, galleryFor, roomPhotos };
