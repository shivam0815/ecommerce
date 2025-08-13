import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';

const ConnectionStatusIndicator = ({ 
  connectionState = 'connected', 
  lastUpdate = new Date(),
  className = '' 
}) => {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const diff = Math.floor((now - new Date(lastUpdate)) / 1000);
      
      if (diff < 60) {
        setTimeAgo('Just now');
      } else if (diff < 3600) {
        setTimeAgo(`${Math.floor(diff / 60)}m ago`);
      } else if (diff < 86400) {
        setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
      } else {
        setTimeAgo(`${Math.floor(diff / 86400)}d ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [lastUpdate]);

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: 'Wifi',
          color: 'text-success',
          bgColor: 'bg-success/10',
          label: 'Connected',
          pulse: true
        };
      case 'connecting':
        return {
          icon: 'Loader2',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          label: 'Connecting',
          pulse: false,
          spin: true
        };
      case 'disconnected':
        return {
          icon: 'WifiOff',
          color: 'text-error',
          bgColor: 'bg-error/10',
          label: 'Disconnected',
          pulse: false
        };
      case 'error':
        return {
          icon: 'AlertTriangle',
          color: 'text-error',
          bgColor: 'bg-error/10',
          label: 'Connection Error',
          pulse: false
        };
      default:
        return {
          icon: 'Wifi',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Unknown',
          pulse: false
        };
    }
  };

  const statusConfig = getStatusConfig();

  const handleRetryConnection = () => {
    // Emit retry connection event or call callback
    console.log('Retrying connection...');
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Indicator */}
      <div className="group relative">
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${statusConfig.bgColor} transition-smooth`}>
          <div className="relative">
            <Icon 
              name={statusConfig.icon} 
              size={14} 
              className={`${statusConfig.color} ${statusConfig.spin ? 'animate-spin' : ''}`} 
            />
            {statusConfig.pulse && (
              <div className={`absolute inset-0 ${statusConfig.color.replace('text-', 'bg-')} rounded-full animate-ping opacity-20`}></div>
            )}
          </div>
          
          <span className={`text-xs font-medium ${statusConfig.color} hidden sm:inline`}>
            {statusConfig.label}
          </span>
          
          <span className="text-xs text-muted-foreground hidden md:inline">
            • {timeAgo}
          </span>
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md modal-shadow opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-smooth delay-150 w-48 text-center">
          <div className="font-medium">{statusConfig.label}</div>
          <div className="text-muted-foreground">Last update: {timeAgo}</div>
          {connectionState === 'disconnected' || connectionState === 'error' ? (
            <button
              onClick={handleRetryConnection}
              className="mt-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition-smooth"
            >
              Retry Connection
            </button>
          ) : null}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></div>
        </div>
      </div>

      {/* Mobile Status Text */}
      <div className="sm:hidden">
        <span className={`text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
};

export default ConnectionStatusIndicator;