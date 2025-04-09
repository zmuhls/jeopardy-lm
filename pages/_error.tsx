import { NextPage } from 'next';

interface ErrorProps {
  statusCode?: number;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-900 text-white p-6">
      <div className="bg-blue-950 p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-400">Error!</h1>
        <p className="text-xl mb-6">
          {statusCode
            ? `An error ${statusCode} occurred on server`
            : 'An error occurred on client'}
        </p>
        <p className="mb-6">
          We apologize for the inconvenience. Please try refreshing the page or come back later.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
};

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;