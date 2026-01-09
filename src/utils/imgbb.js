
// src/utils/imgbb.js
import axios from 'axios';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_KEY;

export const uploadToImgBB = async (file) => {
  const form = new FormData();
  form.append('image', file);

  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    form
  );

  return res.data.data.url;
};

