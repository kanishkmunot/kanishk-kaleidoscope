import { readCoverCredit } from '../lib/cover-credit';

const selection = [
  ['Sunflowers under a blue sky', 'flowers summer nature', 'photo-1723604455348-d9084c8d7e40', 'KENT SHIMAZAKI', 'kent_shimazaki', 'a-field-of-sunflowers-under-a-blue-sky-8TjTUjOew_w'],
  ['A winding forest path', 'woods hiking green nature', 'photo-1770462573521-2c24191ed927', 'Nhung Le', 'nhunglee', 'a-winding-path-through-a-lush-green-forest-mZDBInisGCs'],
  ['Morning light over misty mountains', 'sunrise hills nature landscape', 'photo-1743309411498-a0f4f4b96b65', 'Zetong Li', 'zetong', 'golden-sunrise-illuminates-a-foggy-mountain-landscape-MaeshPdBGV4'],
  ['Waves breaking on a rocky coast', 'sea ocean film water nature', 'photo-1760570317569-4a2b1eddf174', 'Christopher Stites', 'christopherstites', 'rocky-coastline-with-waves-crashing-on-shore-LfgOlvXhZvs'],
  ['Coffee and a notebook on a desk', 'work writing laptop coffee', 'photo-1784065654365-e92dd2c95bf3', 'Aliona Zahrai', 'aliona_zahrai', 'coffee-notebook-pencil-and-laptop-on-a-white-desk-RJyqB0RWZ7Q'],
  ['An open notebook and a cup of coffee', 'writing paper journal', 'photo-1772588627479-06ac7a264916', 'Kelly Sikkema', 'kellysikkema', 'a-cup-of-coffee-and-notebook-with-pen-on-desk-gJykot4THBM'],
] as const;

export const unsplashCovers = selection.map(([title, keywords, asset, author, username, photo]) => ({
  title, keywords,
  src: `https://images.unsplash.com/${asset}`,
  credit: readCoverCredit({ author, profile: `https://unsplash.com/@${username}`, page: `https://unsplash.com/photos/${photo}` })!,
}));
