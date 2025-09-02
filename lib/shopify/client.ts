/**
 * Shopify Admin API Client
 *
 * Core client for making requests to the Shopify Admin API.
 * Uses Next.js 15 best practices with proper error handling and TypeScript.
 */

import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { print } from "graphql"

// Types for Shopify API
interface ShopifyConfig {
  domain: string
  apiAccessToken: string
  apiVersion: string
}

interface ShopifyResponse<T = unknown> {
  data?: T
  errors?: Array<{ message: string }>
}

// Configuration from environment variables
const config: ShopifyConfig = {
  domain: process.env.SHOPIFY_STORE_DOMAIN!,
  apiAccessToken: process.env.SHOPIFY_API_ACCESS_TOKEN!,
  apiVersion: process.env.SHOPIFY_API_VERSION || "2025-07",
}

// Validate required environment variables
if (!config.domain) {
  throw new Error("SHOPIFY_STORE_DOMAIN environment variable is required")
}

if (!config.apiAccessToken) {
  throw new Error("SHOPIFY_API_ACCESS_TOKEN environment variable is required")
}

// Base GraphQL endpoint for Admin API
const endpoint = `https://${config.domain}/admin/api/${config.apiVersion}/graphql.json`

/**
 * Make a GraphQL request to the Shopify Storefront API
 *
 * @param query - GraphQL query string or DocumentNode
 * @param variables - Variables for the query
 * @param tags - Cache tags for Next.js revalidation
 * @returns Promise with the API response
 */
export async function shopifyFetch<T, V = Record<string, unknown>>({
  query,
  variables = {} as V,
  tags = [],
  cache = "force-cache",
}: {
  query: string | TypedDocumentNode<T, V>
  variables?: V
  tags?: string[]
  cache?: RequestCache
}): Promise<T> {
  try {
    // Convert DocumentNode to string if needed
    const queryString = typeof query === "string" ? query : print(query)

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.apiAccessToken,
        // Optional: Include admin API specific headers
        ...(process.env.NODE_ENV === "development" && {
          "User-Agent": "Shopify Analytics Dashboard/1.0",
        }),
      },
      body: JSON.stringify({
        query: queryString,
        variables,
      }),
      cache,
      // Next.js 15 cache tags for revalidation
      next: {
        tags: ["shopify", ...tags],
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json: ShopifyResponse<T> = await response.json()

    // Handle GraphQL errors
    if (json.errors) {
      console.error("Shopify GraphQL errors:", json.errors)
      throw new Error(
        `GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
      )
    }

    if (!json.data) {
      throw new Error("No data returned from Shopify API")
    }

    return json.data
  } catch (error) {
    console.error("Shopify API request failed:", error)

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Shopify API request failed: ${error.message}`)
    }

    throw new Error("Shopify API request failed with unknown error")
  }
}

/**
 * Remove edges and node wrapper from Shopify GraphQL responses
 * This is a common pattern in Shopify's GraphQL API
 */
export function removeEdgesAndNodes<T>(array: { edges: { node: T }[] }): T[] {
  return array.edges.map((edge) => edge.node)
}

/**
 * Extract single item from Shopify GraphQL response
 */
export function extractNode<T>(item: { node: T } | null): T | null {
  return item?.node || null
}

/**
 * Create cache tags for orders (useful for revalidation)
 */
export function createOrderCacheTags(orderIds: string[]): string[] {
  return orderIds.map((id) => `order-${id}`)
}

/**
 * Create cache tags for products (useful for revalidation)
 */
export function createProductCacheTags(productIds: string[]): string[] {
  return productIds.map((id) => `product-${id}`)
}

/**
 * Create cache tags for customers (useful for revalidation)
 */
export function createCustomerCacheTags(customerIds: string[]): string[] {
  return customerIds.map((id) => `customer-${id}`)
}

/**
 * Normalize Shopify GraphQL ID (removes gid://shopify/... prefix)
 */
export function normalizeId(id: string): string {
  return id.replace(/^gid:\/\/shopify\/\w+\//, "")
}

/**
 * Create Shopify GraphQL ID from normalized ID
 */
export function createShopifyId(type: string, id: string): string {
  return `gid://shopify/${type}/${id}`
}

// Export configuration for use in other parts of the app
export { config as shopifyConfig }
