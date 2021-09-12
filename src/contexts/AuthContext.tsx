import Router from "next/dist/client/router";
import { useState } from "react";
import { createContext } from "react";
import { setCookie, parseCookies, destroyCookie } from 'nookies'

import { api } from "../services/api";
import { useEffect } from "react";

type User = {
  email: string
  permissions: string[]
  roles: string[]
}

type SignInCredentials = {
  email: string
  password: string
}

interface AuthContextData {
  signIn(credentials: SignInCredentials): Promise<void>
  isAuthenticated: boolean
  user: User
}

export function signOut() {
  destroyCookie(undefined, 'nextauth.token')
  destroyCookie(undefined, 'nextauth.refreshToken')

  Router.push('/')
}

export const AuthContext = createContext({} as AuthContextData)

export const AuthContextProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User>()
  let isAuthenticated = !!user

  // when the user first visits the page, checks if cookies are present or not and
  // set email, permission and roles to application state "user"
  useEffect(() => {
    const { 'nextauth.token': token } = parseCookies()

    if (token) {
      api.get('/me').then(response => {
        const { email, permissions, roles } = response.data

        setUser({ email, permissions, roles })
      }).catch(() => {
        signOut()
      })
    }
  }, [])

  async function signIn({ email, password }: SignInCredentials) {
    try {
      const response = await api.post('sessions', {
        email,
        password,
      })

      const { token, refreshToken, permissions, roles } = response.data

      // saving token in the cookies
      setCookie(undefined, 'nextauth.token', token, { // since it's client side usage the "context" 
        maxAge: 60 * 60 * 24 * 30, // 30 days         // is set to undefined
        path: '/',
      })

      //saving token refresh in the cookies
      setCookie(undefined, 'nextauth.refreshToken', refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })

      setUser({
        email,
        permissions,
        roles,
      })

      // updates Authorization header in order to be able to make requests from another pages
      // after login, since the first time the user sign in the token field is empty
      api.defaults.headers['Authorization'] = `Bearer ${token}`

      // redirects user to /dashboard route if signIn is successfull
      Router.push('/dashboard')
    } catch (err) {
      console.log(err)
    }
  }

  return (
    <AuthContext.Provider value={{ signIn, isAuthenticated, user }}>
      {children}
    </AuthContext.Provider>
  )
}
