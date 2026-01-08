// src/utils/imgbb.js
const API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

export const uploadToImgBB = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`api.imgbb.com{API_KEY}`, {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  return result.data.display_url; 
};
