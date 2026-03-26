import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { z } from "zod";

// Schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "OTP must be 6 digits"),
});

// Hooks
export function useUser() {
  return useQuery({
    queryKey: ['/auth/me'],
    queryFn: () => fetchApi<{ user: any, balance: number }>('/profile').catch(() => null),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: z.infer<typeof loginSchema>) =>
      fetchApi<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.setQueryData(['/auth/me'], data.user);
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (data: z.infer<typeof signupSchema>) =>
      fetchApi<{ message: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: z.infer<typeof verifySchema>) =>
      fetchApi<{ token: string; user: any }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.setQueryData(['/auth/me'], data.user);
    },
  });
}

export function useGoogleSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credential: string) =>
      fetchApi<{ token: string; user: any }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ token: credential }),
      }),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.setQueryData(['/auth/me'], data.user);
    },
  });
}

export function useAddPhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) =>
      fetchApi<{ success: boolean; phone: string }>('/auth/add-phone', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['/auth/me'], (prev: any) =>
        prev ? { ...prev, phone: data.phone } : prev,
      );
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    localStorage.removeItem('token');
    queryClient.setQueryData(['/auth/me'], null);
    queryClient.clear();
    window.location.href = '/auth';
  };
}
