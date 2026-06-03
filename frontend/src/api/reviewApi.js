import axios from "axios";

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const getReviewableProducts = async ({ url, token, orderId }) => {
  return axios.get(`${url}/api/reviews/order/${orderId}/reviewables`, authHeaders(token));
};

export const createProductReview = async ({ url, token, payload }) => {
  return axios.post(`${url}/api/reviews`, payload, authHeaders(token));
};

export const claimReviewReward = async ({ url, token, reviewId }) => {
  return axios.post(`${url}/api/reviews/${reviewId}/claim-reward`, {}, authHeaders(token));
};

export const updateProductReview = async ({ url, token, reviewId, payload }) => {
  return axios.patch(`${url}/api/reviews/${reviewId}`, payload, authHeaders(token));
};
