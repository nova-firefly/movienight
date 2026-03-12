import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

function getGraphQLUri(): string {
  if (process.env.REACT_APP_GRAPHQL_URL) return process.env.REACT_APP_GRAPHQL_URL;
  const { protocol, hostname } = window.location;
  const port = process.env.REACT_APP_BACKEND_PORT || '4000';
  return `${protocol}//${hostname}:${port}/graphql`;
}

const httpLink = new HttpLink({
  uri: getGraphQLUri(),
});

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('authToken');
  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });
  return forward(operation);
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
