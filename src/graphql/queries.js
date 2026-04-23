/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getMyFollowers = /* GraphQL */ `
  query GetMyFollowers($limit: Int, $nextToken: String) {
    getMyFollowers(limit: $limit, nextToken: $nextToken) {
      items {
        followedAt
        status
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getMyFollowings = /* GraphQL */ `
  query GetMyFollowings($limit: Int, $nextToken: String) {
    getMyFollowings(limit: $limit, nextToken: $nextToken) {
      items {
        followedAt
        status
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listUsers = /* GraphQL */ `
  query ListUsers(
    $filter: ModelUserFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listUsers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        username
        email
        displayName
        avatarUrl
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
