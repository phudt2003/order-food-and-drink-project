import axios from "axios";

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const createSepayOrder = async ({ url, token, payload }) => {
  try {
    return await axios.post(`${url}/api/orders`, payload, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }

    return axios.post(`${url}/api/order/create`, payload, authHeaders(token));
  }
};

export const getOrderStatus = async ({ url, token, orderId }) => {
  try {
    return await axios.get(`${url}/api/orders/${orderId}/status`, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  try {
    return await axios.get(`${url}/api/order/${orderId}/status`, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  try {
    return await axios.get(`${url}/api/orders/${orderId}`, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  return axios.get(`${url}/api/order/status/${orderId}`, authHeaders(token));
};

export const getOrderById = async ({ url, token, orderId }) => {
  try {
    return await axios.get(`${url}/api/orders/${orderId}`, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  return axios.get(`${url}/api/order/${orderId}`, authHeaders(token));
};

export const previewOrderEta = async ({ url, token, payload }) => {
  try {
    return await axios.post(`${url}/api/orders/eta`, payload, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  return axios.post(`${url}/api/order/eta`, payload, authHeaders(token));
};

export const confirmOrderDelivered = async ({ url, token, orderId }) => {
  try {
    return await axios.post(`${url}/api/orders/${orderId}/confirm-delivered`, {}, authHeaders(token));
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }
  }

  return axios.post(`${url}/api/order/${orderId}/confirm-delivered`, {}, authHeaders(token));
};
