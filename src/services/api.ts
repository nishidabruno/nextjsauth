import axios, { AxiosError } from 'axios'
import { parseCookies, setCookie } from 'nookies'
import { signOut } from '../contexts/AuthContext'

let cookies = parseCookies()
let isRefreshing = false

let failedRequestsQueue = []

export const api = axios.create({
  baseURL: 'http://localhost:3333',
  headers: {
    Authorization: `Bearer ${cookies['nextauth.token']}`
  }
})

// axios will intercept the response of the back-end after an request
// to see if token refresh is needed

api.interceptors.response.use(response => {
  return response
}, (error: AxiosError) => {
  if (error.response.status === 401) {  // first "if" is to check if error is 401. 
    if (error.response.data?.code === 'token.expired') {
      cookies = parseCookies() // this code can be executed multiple times during user session 
      // so it's necessary to make sure the cookies are up to date

      const { 'nextauth.refreshToken': refreshToken } = cookies

      const originalConfig = error.config

      if (!isRefreshing) {
        isRefreshing = true

        api.post('/refresh', {
          refreshToken
        }).then(response => {
          const { token } = response.data

          setCookie(undefined, 'nextauth.token', token, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
          })

          setCookie(undefined, 'nextauth.refreshToken', response.data.refreshToken, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
          })

          api.defaults.headers['Authorization'] = `Bearer ${token}`

          failedRequestsQueue.forEach(request => request.onSuccess(token))
          failedRequestsQueue = []
        }).catch((err) => {
          failedRequestsQueue.forEach(request => request.onFailure(err))
          failedRequestsQueue = []
        }).finally(() => {
          isRefreshing = false
        })
      }
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          onSuccess: (token: string) => {
            originalConfig.headers['Authorization'] = `Bearer ${token}`
            resolve(api(originalConfig))
          },
          onFailure: (err: AxiosError) => {
            reject(err)
          }
        })
      })
    } else { // It can be error 401 but not token issue. In this case logout is needed.
      signOut()
    }
  }

  return Promise.reject(error)
})