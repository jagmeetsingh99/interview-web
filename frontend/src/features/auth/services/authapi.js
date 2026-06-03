import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export async function register({ username, email, password }) {
    // eslint-disable-next-line no-useless-catch
    try {
        const response = await 
        api.post('/api/auth/register', { username, email, password })
        localStorage.setItem("token", response.data.token)
        return response.data
    } catch (err) {
        throw err
    }
}

export async function login({ email, password }) {
    // eslint-disable-next-line no-useless-catch
    try {
        const response = await api.post("/api/auth/login", { email, password })
        localStorage.setItem("token", response.data.token)
        return response.data
    } catch (err) {
        throw err
    }
}

export async function logout() {
    // eslint-disable-next-line no-useless-catch
    try {
        const response = await api.get("/api/auth/logout")
        localStorage.removeItem("token")
        return response.data
    } catch (err) {
        throw err
    }
}

export async function getMe() {
    // eslint-disable-next-line no-useless-catch
    try {
        const response = await api.get("/api/auth/me")
        return response.data
    } catch (e) {
        throw e
    }
}