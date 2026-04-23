/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getMyProfile = /* GraphQL */ `
  query GetMyProfile {
    getMyProfile {
      id
      username
      email
      displayName
      avatarUrl
      createdAt
      __typename
    }
  }
`;
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
export const getMyPendingFollowRequests = /* GraphQL */ `
  query GetMyPendingFollowRequests($limit: Int, $nextToken: String) {
    getMyPendingFollowRequests(limit: $limit, nextToken: $nextToken) {
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
export const getMyNotifications = /* GraphQL */ `
  query GetMyNotifications($limit: Int, $nextToken: String) {
    getMyNotifications(limit: $limit, nextToken: $nextToken) {
      items {
        id
        recipientId
        senderId
        type
        read
        createdAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
