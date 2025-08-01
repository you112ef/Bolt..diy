import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'connected' | 'premium' | 'coming-soon';
  category: 'development' | 'productivity' | 'communication' | 'design' | 'analytics';
  features: string[];
  isFree: boolean;
  isPopular?: boolean;
}

const INTEGRATIONS: Integration[] = [
  // Development Tools
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect your repositories and manage code directly',
    icon: 'i-simple-icons:github',
    status: 'connected',
    category: 'development',
    features: ['Repository Management', 'Code Review', 'Issue Tracking', 'CI/CD Integration'],
    isFree: true,
    isPopular: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Complete DevOps platform integration',
    icon: 'i-simple-icons:gitlab',
    status: 'available',
    category: 'development',
    features: ['Repository Management', 'CI/CD Pipelines', 'Issue Tracking', 'Container Registry'],
    isFree: true,
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Git code hosting and collaboration platform',
    icon: 'i-simple-icons:bitbucket',
    status: 'available',
    category: 'development',
    features: ['Repository Management', 'Pull Requests', 'Jira Integration', 'Pipelines'],
    isFree: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy and host your applications instantly',
    icon: 'i-simple-icons:vercel',
    status: 'connected',
    category: 'development',
    features: ['Instant Deployments', 'Preview URLs', 'Custom Domains', 'Analytics'],
    isFree: true,
    isPopular: true,
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Build, deploy, and manage modern web projects',
    icon: 'i-simple-icons:netlify',
    status: 'connected',
    category: 'development',
    features: ['Continuous Deployment', 'Form Handling', 'Serverless Functions', 'CDN'],
    isFree: true,
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Deploy your code with zero configuration',
    icon: 'i-simple-icons:railway',
    status: 'available',
    category: 'development',
    features: ['Zero Config Deploy', 'Database Hosting', 'Custom Domains', 'Team Collaboration'],
    isFree: true,
  },

  // Productivity Tools
  {
    id: 'notion',
    name: 'Notion',
    description: 'All-in-one workspace for notes and collaboration',
    icon: 'i-simple-icons:notion',
    status: 'available',
    category: 'productivity',
    features: ['Note Taking', 'Project Management', 'Database', 'Templates'],
    isFree: true,
    isPopular: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication and collaboration platform',
    icon: 'i-simple-icons:slack',
    status: 'available',
    category: 'productivity',
    features: ['Team Chat', 'File Sharing', 'Integrations', 'Video Calls'],
    isFree: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Voice, video, and text communication platform',
    icon: 'i-simple-icons:discord',
    status: 'available',
    category: 'productivity',
    features: ['Voice Channels', 'Text Channels', 'Screen Sharing', 'Bots'],
    isFree: true,
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Visual project management with boards and cards',
    icon: 'i-simple-icons:trello',
    status: 'available',
    category: 'productivity',
    features: ['Kanban Boards', 'Task Management', 'Team Collaboration', 'Automation'],
    isFree: true,
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Work management platform for teams',
    icon: 'i-simple-icons:asana',
    status: 'available',
    category: 'productivity',
    features: ['Project Management', 'Task Tracking', 'Team Calendar', 'Reporting'],
    isFree: true,
  },

  // Communication Tools
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Video conferencing and online meetings',
    icon: 'i-simple-icons:zoom',
    status: 'available',
    category: 'communication',
    features: ['Video Meetings', 'Screen Sharing', 'Recording', 'Webinars'],
    isFree: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Collaboration platform for work and education',
    icon: 'i-simple-icons:microsoftteams',
    status: 'available',
    category: 'communication',
    features: ['Team Chat', 'Video Calls', 'File Sharing', 'Office Integration'],
    isFree: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Secure messaging and file sharing',
    icon: 'i-simple-icons:telegram',
    status: 'available',
    category: 'communication',
    features: ['Secure Messaging', 'File Sharing', 'Channels', 'Bots'],
    isFree: true,
  },

  // Design Tools
  {
    id: 'figma',
    name: 'Figma',
    description: 'Collaborative interface design tool',
    icon: 'i-simple-icons:figma',
    status: 'available',
    category: 'design',
    features: ['UI/UX Design', 'Prototyping', 'Collaboration', 'Design Systems'],
    isFree: true,
    isPopular: true,
  },
  {
    id: 'canva',
    name: 'Canva',
    description: 'Graphic design and visual content creation',
    icon: 'i-simple-icons:canva',
    status: 'available',
    category: 'design',
    features: ['Graphic Design', 'Templates', 'Collaboration', 'Brand Kit'],
    isFree: true,
  },
  {
    id: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    description: 'Professional creative software suite',
    icon: 'i-simple-icons:adobecreativecloud',
    status: 'premium',
    category: 'design',
    features: ['Photoshop', 'Illustrator', 'InDesign', 'XD'],
    isFree: false,
  },

  // Analytics Tools
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Web analytics and reporting platform',
    icon: 'i-simple-icons:googleanalytics',
    status: 'available',
    category: 'analytics',
    features: ['Website Analytics', 'User Behavior', 'Conversion Tracking', 'Reports'],
    isFree: true,
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product analytics and user behavior tracking',
    icon: 'i-simple-icons:mixpanel',
    status: 'available',
    category: 'analytics',
    features: ['Event Tracking', 'Funnel Analysis', 'A/B Testing', 'User Profiles'],
    isFree: true,
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    description: 'Website heatmaps and user behavior analytics',
    icon: 'i-simple-icons:hotjar',
    status: 'available',
    category: 'analytics',
    features: ['Heatmaps', 'Session Recordings', 'Feedback Tools', 'Conversion Funnels'],
    isFree: true,
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Product analytics for digital products',
    icon: 'i-simple-icons:amplitude',
    status: 'available',
    category: 'analytics',
    features: ['Event Analytics', 'User Segmentation', 'Cohort Analysis', 'Retention'],
    isFree: true,
  },

  // Coming Soon
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management for software teams',
    icon: 'i-simple-icons:linear',
    status: 'coming-soon',
    category: 'development',
    features: ['Issue Tracking', 'Roadmaps', 'Automation', 'Integrations'],
    isFree: true,
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'All-in-one productivity platform',
    icon: 'i-simple-icons:clickup',
    status: 'coming-soon',
    category: 'productivity',
    features: ['Task Management', 'Docs', 'Chat', 'Goals'],
    isFree: true,
  },
];

const CATEGORIES = [
  { id: 'all', name: 'All Integrations', icon: 'i-ph:grid-four' },
  { id: 'development', name: 'Development', icon: 'i-ph:code' },
  { id: 'productivity', name: 'Productivity', icon: 'i-ph:briefcase' },
  { id: 'communication', name: 'Communication', icon: 'i-ph:chat-circle' },
  { id: 'design', name: 'Design', icon: 'i-ph:paint-brush' },
  { id: 'analytics', name: 'Analytics', icon: 'i-ph:chart-line' },
];

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
    icon: 'i-ph:check-circle',
  },
  connected: {
    label: 'Connected',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: 'i-ph:link',
  },
  premium: {
    label: 'Premium',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    icon: 'i-ph:crown',
  },
  'coming-soon': {
    label: 'Coming Soon',
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: 'i-ph:clock',
  },
};

export default function IntegrationsTab() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);

  const filteredIntegrations = INTEGRATIONS.filter((integration) => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !showConnectedOnly || integration.status === 'connected';
    
    return matchesCategory && matchesSearch && matchesStatus;
  });

  const handleConnect = (integration: Integration) => {
    // TODO: Implement connection logic
    console.log('Connecting to:', integration.name);
  };

  const handleDisconnect = (integration: Integration) => {
    // TODO: Implement disconnection logic
    console.log('Disconnecting from:', integration.name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <div className="i-ph:puzzle-piece w-6 h-6 text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent" />
          <div>
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
              Integrations
            </h2>
            <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
              Connect your favorite tools and services
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConnectedOnly(!showConnectedOnly)}
            className={classNames(
              'flex items-center gap-2',
              showConnectedOnly && 'bg-bolt-elements-item-backgroundActive/10 text-bolt-elements-textPrimary'
            )}
          >
            <div className="i-ph:link w-4 h-4" />
            Connected Only
          </Button>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Search */}
        <div className="relative">
          <div className="i-ph:magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary dark:placeholder-bolt-elements-textSecondary focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-contentAccent/20 focus:border-bolt-elements-item-contentAccent"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={classNames(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                selectedCategory === category.id
                  ? 'bg-bolt-elements-item-contentAccent text-white'
                  : 'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary'
              )}
            >
              <div className={classNames('w-4 h-4', category.icon)} />
              {category.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Integrations Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {filteredIntegrations.map((integration, index) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="group relative bg-bolt-elements-background dark:bg-bolt-elements-background rounded-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor p-4 hover:border-bolt-elements-item-contentAccent/30 transition-all duration-200 hover:shadow-lg"
          >
            {/* Popular Badge */}
            {integration.isPopular && (
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  Popular
                </Badge>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 rounded-lg flex items-center justify-center">
                <div className={classNames('w-5 h-5', integration.icon)} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary truncate">
                  {integration.name}
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary line-clamp-2">
                  {integration.description}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-between mb-3">
              <Badge
                variant="outline"
                className={classNames(
                  'text-xs flex items-center gap-1',
                  STATUS_CONFIG[integration.status].color
                )}
              >
                <div className={classNames('w-3 h-3', STATUS_CONFIG[integration.status].icon)} />
                {STATUS_CONFIG[integration.status].label}
              </Badge>
              
              {!integration.isFree && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <div className="i-ph:crown w-3 h-3" />
                  Premium
                </Badge>
              )}
            </div>

            {/* Features */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {integration.features.slice(0, 3).map((feature, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary rounded-md"
                  >
                    {feature}
                  </span>
                ))}
                {integration.features.length > 3 && (
                  <span className="text-xs px-2 py-1 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary rounded-md">
                    +{integration.features.length - 3} more
                  </span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex gap-2">
              {integration.status === 'connected' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(integration)}
                  className="flex-1 flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                >
                  <div className="i-ph:link-break w-4 h-4" />
                  Disconnect
                </Button>
              ) : integration.status === 'coming-soon' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="flex-1 flex items-center gap-2 opacity-50 cursor-not-allowed"
                >
                  <div className="i-ph:clock w-4 h-4" />
                  Coming Soon
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleConnect(integration)}
                  className="flex-1 flex items-center gap-2"
                >
                  <div className="i-ph:link w-4 h-4" />
                  Connect
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="px-2 hover:bg-bolt-elements-item-backgroundActive/10"
              >
                <div className="i-ph:info w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="i-ph:puzzle-piece w-16 h-16 mx-auto mb-4 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary opacity-50" />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary mb-2">
            No integrations found
          </h3>
          <p className="text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
            Try adjusting your search or filters to find what you're looking for.
          </p>
        </motion.div>
      )}

      {/* Footer Info */}
      <motion.div
        className="bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 p-4 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-start gap-3">
          <div className="i-ph:lightbulb w-5 h-5 text-bolt-elements-icon-success dark:text-bolt-elements-icon-success flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary mb-1">
              Need a specific integration?
            </h4>
            <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
              We're constantly adding new integrations. If you don't see what you need, let us know and we'll prioritize it for future releases.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 flex items-center gap-2"
            >
              <div className="i-ph:envelope w-4 h-4" />
              Request Integration
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}